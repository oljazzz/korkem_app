package kz.korkem.invoice.report;

import static kz.korkem.invoice.report.ReportTime.startOf;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.function.Function;
import kz.korkem.invoice.report.ReportDtos.SalesReport;
import kz.korkem.invoice.report.ReportDtos.SalesRow;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** "Sold products" report: total quantity and amount per product over the invoices a filter selects. */
@Service
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class SalesReportService {

    /** Which invoices the report covers; every field is optional. */
    public record Filter(LocalDate from, LocalDate to, Long clientId, String city, List<Long> invoiceIds) {}

    private final NamedParameterJdbcTemplate jdbc;

    public SalesReport report(Filter f) {
        MapSqlParameterSource p = new MapSqlParameterSource();
        String where = where(f, p);
        List<SalesRow> rows = jdbc.query("""
                select l.product_name, max(case when l.variant_id is not null then pr.name end) as group_name,
                       max(c.name) as category, sum(l.quantity) as qty, sum(l.total) as total,
                       sum(l.vat) as vat, count(distinct l.invoice_id) as invoices
                from invoice_line l
                join invoice i on i.id = l.invoice_id
                left join category c on c.id = l.category_id
                left join product pr on pr.id = l.product_id
                """ + where + """
                 group by l.product_name
                 order by sum(l.total) desc, l.product_name
                """, p, (rs, n) -> {
            BigDecimal qty = rs.getBigDecimal("qty");
            BigDecimal total = rs.getBigDecimal("total");
            String product = rs.getString("product_name");
            String group = rs.getString("group_name");
            return new SalesRow(product, group == null ? product : group, rs.getString("category"), qty,
                    qty.signum() == 0 ? BigDecimal.ZERO : total.divide(qty, 2, RoundingMode.HALF_UP),
                    total, rs.getBigDecimal("vat"), rs.getLong("invoices"));
        });
        Integer invoiceCount = jdbc.queryForObject("select count(*) from invoice i " + where, p, Integer.class);
        return new SalesReport(f.from(), f.to(), invoiceCount == null ? 0 : invoiceCount, rows,
                sum(rows, SalesRow::quantity), sum(rows, SalesRow::total), sum(rows, SalesRow::vat));
    }

    /** SQL "where" over invoices aliased {@code i}; fills the parameters it uses. Empty when nothing filters. */
    private static String where(Filter f, MapSqlParameterSource p) {
        List<String> cond = new ArrayList<>();
        if (f.from() != null) {
            cond.add("i.created_at >= :from");
            p.addValue("from", startOf(f.from()));
        }
        if (f.to() != null) {
            cond.add("i.created_at < :to");
            p.addValue("to", startOf(f.to().plusDays(1)));
        }
        if (f.clientId() != null) {
            cond.add("i.client_id = :clientId");
            p.addValue("clientId", f.clientId());
        }
        if (f.city() != null && !f.city().isBlank()) {
            cond.add("i.client_id in (select cl.id from client cl where lower(cl.city) = lower(:city))");
            p.addValue("city", f.city().trim());
        }
        if (f.invoiceIds() != null && !f.invoiceIds().isEmpty()) {
            cond.add("i.id in (:ids)");
            p.addValue("ids", f.invoiceIds());
        }
        return cond.isEmpty() ? "" : " where " + String.join(" and ", cond);
    }

    private static <T> BigDecimal sum(List<T> rows, Function<T, BigDecimal> f) {
        return rows.stream().map(f).filter(Objects::nonNull).reduce(BigDecimal.ZERO, BigDecimal::add);
    }
}
