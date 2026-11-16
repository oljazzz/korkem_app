package kz.korkem.invoice.repository.query;

import static kz.korkem.invoice.constants.DateProps.endOf;
import static kz.korkem.invoice.constants.DateProps.startOf;

import java.math.BigDecimal;
import java.sql.Date;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.util.List;
import kz.korkem.invoice.dto.ReconciliationDtos.Entry;
import kz.korkem.invoice.dto.ReconciliationDtos.EntryKind;
import kz.korkem.invoice.enums.PaymentMethod;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

/**
 * A client's invoices and payments by day, under the same rules as ClientBalanceQuery. Invoices from
 * before payments were tracked (legacy_paid) are settled as issued (their open part at the time is the
 * client's opening debt): they are listed with equal debit and credit, so they show in the turnover but
 * never change the balance. An invoice counts on its Almaty date, a payment on the day it was paid.
 */
@Repository
@RequiredArgsConstructor
public class ReconciliationQuery {

    private static final String ZONE = "Asia/Almaty";

    private final NamedParameterJdbcTemplate jdbc;

    /** Opening debt + invoices before {@code from} − payments before {@code from}. */
    public BigDecimal balanceBefore(Long clientId, LocalDate from) {
        BigDecimal v = jdbc.queryForObject("""
                select c.opening_debt
                     + (select coalesce(sum(l.total), 0) from invoice i join invoice_line l on l.invoice_id = i.id
                        where i.client_id = c.id and not i.legacy_paid and i.created_at < :fromTs)
                     - (select coalesce(sum(p.amount), 0) from payment p join invoice i on i.id = p.invoice_id
                        where i.client_id = c.id and not i.legacy_paid and p.paid_on < :from)
                from client c where c.id = :id
                """, new MapSqlParameterSource("id", clientId)
                .addValue("from", Date.valueOf(from))
                .addValue("fromTs", Timestamp.from(startOf(from))), BigDecimal.class);
        return v == null ? BigDecimal.ZERO : v;
    }

    /** Invoices and payments from {@code from} to {@code to} (both inclusive); by day, invoices first. */
    public List<Entry> entries(Long clientId, LocalDate from, LocalDate to) {
        return jdbc.query("""
                select 'INVOICE' as kind, (i.created_at at time zone '%1$s')::date as day, i.id as invoice_id,
                       i.number, null as method, i.legacy_paid, coalesce(sum(l.total), 0) as debit,
                       case when i.legacy_paid then coalesce(sum(l.total), 0) else 0 end as credit,
                       i.created_at as at, i.id as seq
                from invoice i left join invoice_line l on l.invoice_id = i.id
                where i.client_id = :id and i.created_at >= :fromTs and i.created_at < :toTs
                group by i.id
                union all
                select 'PAYMENT', p.paid_on, i.id, i.number, p.method, false, 0, p.amount, p.created_at, p.id
                from payment p join invoice i on i.id = p.invoice_id
                where i.client_id = :id and not i.legacy_paid and p.paid_on between :from and :to
                order by day, kind, at, seq
                """.formatted(ZONE), new MapSqlParameterSource("id", clientId)
                .addValue("from", Date.valueOf(from))
                .addValue("to", Date.valueOf(to))
                .addValue("fromTs", Timestamp.from(startOf(from)))
                .addValue("toTs", Timestamp.from(endOf(to))),
                (rs, n) -> {
                    String method = rs.getString("method");
                    return new Entry(rs.getDate("day").toLocalDate(), EntryKind.valueOf(rs.getString("kind")),
                            rs.getLong("invoice_id"), rs.getLong("number"),
                            method == null ? null : PaymentMethod.valueOf(method), rs.getBoolean("legacy_paid"),
                            rs.getBigDecimal("debit"), rs.getBigDecimal("credit"));
                });
    }
}
