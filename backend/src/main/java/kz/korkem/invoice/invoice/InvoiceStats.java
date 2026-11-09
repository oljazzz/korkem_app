package kz.korkem.invoice.invoice;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import kz.korkem.invoice.invoice.InvoiceDtos.InvoiceSummary;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Component;

/** Invoice list totals in SQL, with the same filters as {@link InvoiceRepository#search}. */
@Component
@RequiredArgsConstructor
class InvoiceStats {

    private final NamedParameterJdbcTemplate jdbc;

    InvoiceSummary summary(Long number, String q, Long clientId, Instant from, Instant to, boolean dueOnly) {
        MapSqlParameterSource p = new MapSqlParameterSource();
        List<String> cond = new ArrayList<>();
        if (number != null) {
            cond.add("i.number = :number");
            p.addValue("number", number);
        }
        if (!q.isEmpty()) {
            cond.add("(lower(c.name) like :q or lower(coalesce(c.address, '')) like :q)");
            p.addValue("q", "%" + q.toLowerCase() + "%");
        }
        if (clientId != null) {
            cond.add("i.client_id = :clientId");
            p.addValue("clientId", clientId);
        }
        if (from != null) {
            cond.add("i.created_at >= :from");
            p.addValue("from", Timestamp.from(from));
        }
        if (to != null) {
            cond.add("i.created_at < :to");
            p.addValue("to", Timestamp.from(to));
        }
        String where = cond.isEmpty() ? "" : " where " + String.join(" and ", cond);
        return jdbc.queryForObject("""
                select count(*), coalesce(sum(t.total), 0),
                       coalesce(sum(case when t.legacy_paid then 0 when t.total > t.paid then t.total - t.paid else 0 end), 0)
                from (
                    select i.legacy_paid,
                           coalesce((select sum(l.total) from invoice_line l where l.invoice_id = i.id), 0) as total,
                           coalesce((select sum(pm.amount) from payment pm where pm.invoice_id = i.id), 0) as paid
                    from invoice i left join client c on c.id = i.client_id
                """ + where + """
                ) t
                """ + (dueOnly ? " where t.legacy_paid = false and t.total > t.paid" : ""),
                p, (rs, n) -> new InvoiceSummary(rs.getLong(1), rs.getBigDecimal(2), rs.getBigDecimal(3)));
    }
}
