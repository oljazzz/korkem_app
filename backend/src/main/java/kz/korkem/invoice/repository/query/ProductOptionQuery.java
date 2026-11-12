package kz.korkem.invoice.repository.query;

import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

/**
 * Finds what can go on an invoice line: products without colours and every active colour, matched word by
 * word against the product name or the colour ("статус ақ" finds the white СТАТУС enamel).
 */
@Repository
@RequiredArgsConstructor
public class ProductOptionQuery {

    /** A product, or one colour of it ({@code variantId} null for products without colours). */
    public record Row(long productId, Long variantId) {}

    private final NamedParameterJdbcTemplate jdbc;

    /** In price-list order: category, product, colour. */
    public List<Row> find(String text, Long categoryId, int limit) {
        SqlWhere where = new SqlWhere().param("limit", limit);
        String[] words = text.trim().split("\\s+");
        for (int i = 0; i < words.length; i++) {
            where.contains("(lower(pr.name) like :w" + i + " or lower(coalesce(v.name, '')) like :w" + i + ")", "w" + i, words[i]);
        }
        where.eq("pr.category_id", "categoryId", categoryId)
                // Products with active colours are listed only by colour; the rest as themselves
                .and("(v.id is not null or not exists (select 1 from product_variant x where x.product_id = pr.id and x.active))");
        return jdbc.query("""
                select pr.id as pid, v.id as vid
                from product pr
                left join category c on c.id = pr.category_id
                left join product_variant v on v.product_id = pr.id and v.active
                """ + where.sql() + """
                 order by c.sort_order nulls last, c.name nulls last, pr.sort_order nulls last, pr.name,
                          v.sort_order nulls last, v.id
                 limit :limit
                """, where.params(), (rs, n) -> new Row(rs.getLong("pid"), rs.getObject("vid", Long.class)));
    }
}
