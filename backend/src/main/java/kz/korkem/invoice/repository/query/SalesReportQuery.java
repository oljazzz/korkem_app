package kz.korkem.invoice.repository.query;

import static kz.korkem.invoice.constants.DateProps.startOf;

import java.math.BigDecimal;
import java.util.List;
import kz.korkem.invoice.dto.ReportDtos.SalesFilter;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

/** Invoice lines summed per product over the invoices a {@link SalesFilter} selects. */
@Repository
@RequiredArgsConstructor
public class SalesReportQuery {

    /** {@code groupName} is null for products without colours. */
    public record Row(String productName, String groupName, String categoryName, BigDecimal quantity,
                      BigDecimal total, BigDecimal vat, long invoices) {}

    private final NamedParameterJdbcTemplate jdbc;

    /** Biggest amount first. */
    public List<Row> rows(SalesFilter f) {
        SqlWhere where = where(f);
        return jdbc.query("""
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
                """, where.params(), (rs, n) -> new Row(rs.getString("product_name"), rs.getString("group_name"),
                rs.getString("category"), rs.getBigDecimal("qty"), rs.getBigDecimal("total"),
                rs.getBigDecimal("vat"), rs.getLong("invoices")));
    }

    public int invoiceCount(SalesFilter f) {
        SqlWhere where = where(f);
        Integer count = jdbc.queryForObject("select count(*) from invoice i " + where.sql(), where.params(), Integer.class);
        return count == null ? 0 : count;
    }

    /** Conditions over invoices aliased {@code i}; filters that are not set are left out. */
    private static SqlWhere where(SalesFilter f) {
        return new SqlWhere()
                .atLeast("i.created_at", "from", startOf(f.from()))
                .before("i.created_at", "to", f.to() == null ? null : startOf(f.to().plusDays(1)))
                .eq("i.client_id", "clientId", f.clientId())
                .and("i.client_id in (select cl.id from client cl where lower(cl.city) = lower(:city))", "city",
                        f.city() == null ? null : f.city().trim())
                .in("i.id", "ids", f.invoiceIds());
    }
}
