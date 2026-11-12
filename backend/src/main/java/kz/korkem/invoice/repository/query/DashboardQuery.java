package kz.korkem.invoice.repository.query;

import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import kz.korkem.invoice.dto.ReportDtos.Ranked;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

/** Read queries of the dashboard; every period is {@code [from, to)}. */
@Repository
@RequiredArgsConstructor
public class DashboardQuery {

    /** One invoice's line totals. */
    public record InvoiceTotal(Instant createdAt, Long clientId, BigDecimal total, BigDecimal vat) {}

    private final NamedParameterJdbcTemplate jdbc;

    public List<InvoiceTotal> invoiceTotals(Instant from, Instant to) {
        return jdbc.query("""
                select i.created_at, i.client_id, coalesce(sum(l.total), 0) as total, coalesce(sum(l.vat), 0) as vat
                from invoice i left join invoice_line l on l.invoice_id = i.id
                where i.created_at >= :from and i.created_at < :to
                group by i.id, i.created_at, i.client_id
                """, range(from, to), (rs, n) -> new InvoiceTotal(rs.getTimestamp("created_at").toInstant(),
                rs.getObject("client_id", Long.class), rs.getBigDecimal("total"), rs.getBigDecimal("vat")));
    }

    public Instant lastInvoiceAt() {
        Timestamp last = jdbc.queryForObject("select max(created_at) from invoice", new MapSqlParameterSource(), Timestamp.class);
        return last == null ? null : last.toInstant();
    }

    public List<Ranked> topProducts(Instant from, Instant to, int limit) {
        return jdbc.query("""
                select l.product_name as name, sum(l.total) as revenue, sum(l.quantity) as qty,
                       count(distinct l.invoice_id) as invoices
                from invoice_line l join invoice i on i.id = l.invoice_id
                where i.created_at >= :from and i.created_at < :to
                group by l.product_name order by sum(l.total) desc limit :top
                """, range(from, to).addValue("top", limit), DashboardQuery::ranked);
    }

    public List<Ranked> topClients(Instant from, Instant to, int limit) {
        return jdbc.query("""
                select c.id as id, c.name as name, sum(l.total) as revenue, sum(l.quantity) as qty,
                       count(distinct i.id) as invoices
                from invoice i join client c on c.id = i.client_id
                join invoice_line l on l.invoice_id = i.id
                where i.created_at >= :from and i.created_at < :to
                group by c.id, c.name order by sum(l.total) desc limit :top
                """, range(from, to).addValue("top", limit), (rs, n) -> new Ranked(rs.getLong("id"), rs.getString("name"),
                rs.getBigDecimal("revenue"), rs.getBigDecimal("qty"), rs.getLong("invoices")));
    }

    /**
     * Every category's share; lines without a category are counted under {@code noCategory}.
     * Grouped by the first column: PostgreSQL does not see two bound :noCategory as the same expression.
     */
    public List<Ranked> categories(Instant from, Instant to, String noCategory) {
        return jdbc.query("""
                select coalesce(c.name, :noCategory) as name, sum(l.total) as revenue, sum(l.quantity) as qty,
                       count(distinct l.invoice_id) as invoices
                from invoice_line l join invoice i on i.id = l.invoice_id
                left join category c on c.id = l.category_id
                where i.created_at >= :from and i.created_at < :to
                group by 1 order by sum(l.total) desc
                """, range(from, to).addValue("noCategory", noCategory), DashboardQuery::ranked);
    }

    /** pgjdbc cannot bind java.time.Instant, hence Timestamp. */
    private static MapSqlParameterSource range(Instant from, Instant to) {
        return new MapSqlParameterSource()
                .addValue("from", Timestamp.from(from))
                .addValue("to", Timestamp.from(to));
    }

    private static Ranked ranked(ResultSet rs, int n) throws SQLException {
        return new Ranked(null, rs.getString("name"), rs.getBigDecimal("revenue"), rs.getBigDecimal("qty"), rs.getLong("invoices"));
    }
}
