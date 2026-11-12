package kz.korkem.invoice.service;

import java.time.Instant;
import kz.korkem.invoice.common.SqlWhere;
import kz.korkem.invoice.dto.InvoiceDtos.InvoiceSummary;
import kz.korkem.invoice.repository.InvoiceRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Component;

/** Invoice list totals in SQL, with the same filters as {@link InvoiceRepository#search}. */
@Component
@RequiredArgsConstructor
public class InvoiceStats {

    private final NamedParameterJdbcTemplate jdbc;

    InvoiceSummary summary(Long number, String q, Long clientId, Instant from, Instant to, boolean dueOnly) {
        SqlWhere where = new SqlWhere()
                .eq("i.number", "number", number)
                .contains("(lower(c.name) like :q or lower(coalesce(c.address, '')) like :q)", "q", q)
                .eq("i.client_id", "clientId", clientId)
                .atLeast("i.created_at", "from", from)
                .before("i.created_at", "to", to);
        // Over the per-invoice totals: only invoices that still owe money
        String owing = dueOnly ? " where t.legacy_paid = false and t.total > t.paid" : "";
        return jdbc.queryForObject("""
                select count(*), coalesce(sum(t.total), 0),
                       coalesce(sum(case when t.legacy_paid then 0 when t.total > t.paid then t.total - t.paid else 0 end), 0)
                from (
                    select i.legacy_paid,
                           coalesce((select sum(l.total) from invoice_line l where l.invoice_id = i.id), 0) as total,
                           coalesce((select sum(pm.amount) from payment pm where pm.invoice_id = i.id), 0) as paid
                    from invoice i left join client c on c.id = i.client_id
                """ + where.sql() + """
                ) t
                """ + owing,
                where.params(), (rs, n) -> new InvoiceSummary(rs.getLong(1), rs.getBigDecimal(2), rs.getBigDecimal(3)));
    }
}
