package kz.korkem.invoice.repository.query;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import kz.korkem.invoice.dto.ClientDtos.TopProduct;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

/**
 * Client debt and purchase figures, computed in SQL.
 * Debt = opening debt + what is still owed on invoices created after payments were introduced.
 */
@Repository
@RequiredArgsConstructor
public class ClientBalanceQuery {

    // Unpaid amount per client over invoices that are not legacy-paid
    private static final String UNPAID = """
            select i.client_id, sum(coalesce(lt.total, 0) - coalesce(pt.paid, 0)) as unpaid
            from invoice i
            left join (select invoice_id, sum(total) as total from invoice_line group by invoice_id) lt on lt.invoice_id = i.id
            left join (select invoice_id, sum(amount) as paid from payment group by invoice_id) pt on pt.invoice_id = i.id
            where i.legacy_paid = false and i.client_id is not null
            group by i.client_id
            """;

    public record Debtor(Long clientId, BigDecimal debt) {}

    public record Stats(long invoiceCount, BigDecimal total, Instant lastInvoiceAt) {}

    private final NamedParameterJdbcTemplate jdbc;

    public Map<Long, BigDecimal> debts(Collection<Long> clientIds) {
        Map<Long, BigDecimal> result = new HashMap<>();
        if (clientIds.isEmpty()) return result;
        jdbc.query("""
                select c.id, c.opening_debt + coalesce(d.unpaid, 0) as debt
                from client c left join (%s) d on d.client_id = c.id
                where c.id in (:ids)
                """.formatted(UNPAID), new MapSqlParameterSource("ids", clientIds),
                rs -> { result.put(rs.getLong(1), rs.getBigDecimal(2)); });
        return result;
    }

    /** Clients that owe money, largest debt first. */
    public List<Debtor> debtors(int limit) {
        return jdbc.query("""
                select c.id, c.opening_debt + coalesce(d.unpaid, 0) as debt
                from client c left join (%s) d on d.client_id = c.id
                where c.opening_debt + coalesce(d.unpaid, 0) > 0
                order by debt desc, c.id
                limit :limit
                """.formatted(UNPAID), new MapSqlParameterSource("limit", limit),
                (rs, i) -> new Debtor(rs.getLong(1), rs.getBigDecimal(2)));
    }

    /** Total owed by all clients. */
    public BigDecimal totalDebt() {
        BigDecimal v = jdbc.queryForObject("""
                select coalesce(sum(c.opening_debt + coalesce(d.unpaid, 0)), 0)
                from client c left join (%s) d on d.client_id = c.id
                """.formatted(UNPAID), new MapSqlParameterSource(), BigDecimal.class);
        return v == null ? BigDecimal.ZERO : v;
    }

    public Stats stats(Long clientId) {
        return jdbc.queryForObject("""
                select count(distinct i.id), coalesce(sum(l.total), 0), max(i.created_at)
                from invoice i left join invoice_line l on l.invoice_id = i.id
                where i.client_id = :id
                """, new MapSqlParameterSource("id", clientId), (rs, n) -> {
            Timestamp last = rs.getTimestamp(3);
            return new Stats(rs.getLong(1), rs.getBigDecimal(2), last == null ? null : last.toInstant());
        });
    }

    public List<TopProduct> topProducts(Long clientId, int limit) {
        return jdbc.query("""
                select l.product_name, sum(l.quantity), sum(l.total), count(distinct i.id)
                from invoice i join invoice_line l on l.invoice_id = i.id
                where i.client_id = :id
                group by l.product_name
                order by sum(l.total) desc
                limit :limit
                """, new MapSqlParameterSource("id", clientId).addValue("limit", limit),
                (rs, n) -> new TopProduct(rs.getString(1), rs.getBigDecimal(2), rs.getBigDecimal(3), rs.getLong(4)));
    }
}
