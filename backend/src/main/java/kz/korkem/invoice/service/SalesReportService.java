package kz.korkem.invoice.service;


import kz.korkem.invoice.common.SqlWhere;
import kz.korkem.invoice.dto.ReportDtos.SalesReport;
import kz.korkem.invoice.dto.ReportDtos.SalesRow;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.List;
import java.util.Objects;
import java.util.function.Function;

import static kz.korkem.invoice.constants.DateProps.startOf;


/**
 * "Sold products" report: total quantity and amount per product over the invoices a filter selects.
 */
@Service
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class SalesReportService {

    /**
     * Which invoices the report covers; every field is optional.
     */
    public record Filter(LocalDate from, LocalDate to, Long clientId, String city, List<Long> invoiceIds) {
    }

    private final NamedParameterJdbcTemplate jdbc;

    public SalesReport report(Filter f) {
        SqlWhere where = where(f);
        List<SalesRow> rows = jdbc.query("""
                select l.product_name, max(case when l.variant_id is not null then pr.name end) as group_name,
                       max(c.name) as category, sum(l.quantity) as qty, sum(l.total) as total,
                       sum(l.vat) as vat, count(distinct l.invoice_id) as invoices
                from invoice_line l
                join invoice i on i.id = l.invoice_id
                left join category c on c.id = l.category_id
                left join product pr on pr.id = l.product_id
                """ + where.sql() + """
                 group by l.product_name
                 order by sum(l.total) desc, l.product_name
                """, where.params(), (rs, n) -> {
            BigDecimal qty = rs.getBigDecimal("qty");
            BigDecimal total = rs.getBigDecimal("total");
            String product = rs.getString("product_name");
            String group = rs.getString("group_name");
            return new SalesRow(product, group == null ? product : group, rs.getString("category"), qty,
                    qty.signum() == 0 ? BigDecimal.ZERO : total.divide(qty, 2, RoundingMode.HALF_UP),
                    total, rs.getBigDecimal("vat"), rs.getLong("invoices"));
        });
        Integer invoiceCount = jdbc.queryForObject("select count(*) from invoice i " + where.sql(), where.params(), Integer.class);
        return new SalesReport(f.from(), f.to(), invoiceCount == null ? 0 : invoiceCount, rows,
                sum(rows, SalesRow::quantity), sum(rows, SalesRow::total), sum(rows, SalesRow::vat));
    }

    /** Conditions over invoices aliased {@code i}; filters that are not set are left out. */
    private static SqlWhere where(Filter f) {
        return new SqlWhere()
                .atLeast("i.created_at", "from", startOf(f.from()))
                .before("i.created_at", "to", f.to() == null ? null : startOf(f.to().plusDays(1)))
                .eq("i.client_id", "clientId", f.clientId())
                .and("i.client_id in (select cl.id from client cl where lower(cl.city) = lower(:city))", "city",
                        f.city() == null ? null : f.city().trim())
                .in("i.id", "ids", f.invoiceIds());
    }

    private static <T> BigDecimal sum(List<T> rows, Function<T, BigDecimal> f) {
        return rows.stream().map(f).filter(Objects::nonNull).reduce(BigDecimal.ZERO, BigDecimal::add);
    }
}
