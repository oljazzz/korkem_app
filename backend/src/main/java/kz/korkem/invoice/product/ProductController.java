package kz.korkem.invoice.product;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import kz.korkem.invoice.category.Category;
import kz.korkem.invoice.category.CategoryRepository;
import kz.korkem.invoice.common.BadRequestException;
import kz.korkem.invoice.common.NotFoundException;
import kz.korkem.invoice.common.PageResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/products")
@RequiredArgsConstructor
public class ProductController {

    public record VariantDto(Long id, String name, BigDecimal price, boolean active, Integer sortOrder) {
        static VariantDto of(ProductVariant v) {
            return new VariantDto(v.getId(), v.getName(), v.getPrice(), v.isActive(), v.getSortOrder());
        }
    }

    public record ProductDto(Long id, Long categoryId, String categoryName, String name,
                             BigDecimal price, Integer sortOrder, BigDecimal packAmount, PackUnit packUnit,
                             List<VariantDto> variants) {
        static ProductDto of(Product p) {
            Category c = p.getCategory();
            return new ProductDto(p.getId(), c == null ? null : c.getId(), c == null ? null : c.getName(),
                    p.getName(), p.getPrice(), p.getSortOrder(), p.getPackAmount(), p.getPackUnit(),
                    p.getVariants().stream().map(VariantDto::of).toList());
        }
    }

    /** {@code id} null for a new colour; colours left out of the list are removed. */
    public record VariantRequest(
            Long id,
            @NotBlank(message = "{validation.colour.name.required}") @Size(max = 255, message = "{validation.tooLong}") String name,
            @DecimalMin(value = "0", message = "{validation.price.negative}") BigDecimal price,
            Boolean active) {}

    public record ProductRequest(
            Long categoryId,
            @NotBlank(message = "{validation.name.required}") @Size(max = 255, message = "{validation.name.tooLong}") String name,
            @NotNull(message = "{validation.price.required}") @DecimalMin(value = "0", message = "{validation.price.negative}") BigDecimal price,
            Integer sortOrder,
            @DecimalMin(value = "0.001", message = "{validation.pack.positive}")
            @DecimalMax(value = "999999", message = "{validation.pack.tooLarge}") BigDecimal packAmount,
            PackUnit packUnit,
            List<@Valid VariantRequest> variants) {}

    /**
     * One thing that can go on an invoice line: a product without colours, or one colour of a product.
     * {@code label} is the full line name ("СТАТУС ПФ-115 2,6 кг — Ақ").
     */
    public record ProductOption(Long productId, Long variantId, String label, String productName, String variantName,
                                BigDecimal price, BigDecimal packAmount, PackUnit packUnit,
                                Long categoryId, String categoryName) {}

    private static final Sort SORT = Sort.by(
            Sort.Order.asc("category.sortOrder").nullsLast(), Sort.Order.asc("category.name").nullsLast(),
            Sort.Order.asc("sortOrder").nullsLast(), Sort.Order.asc("name"));

    private final ProductRepository repo;
    private final CategoryRepository categories;
    private final NamedParameterJdbcTemplate jdbc;

    @GetMapping
    @Transactional(readOnly = true)
    public PageResponse<ProductDto> list(@RequestParam(defaultValue = "") String q,
                                         @RequestParam(required = false) Long categoryId,
                                         @RequestParam(defaultValue = "0") int page,
                                         @RequestParam(defaultValue = "50") int size) {
        return PageResponse.of(repo.search(q.trim(), categoryId, PageRequest.of(page, PageResponse.clampSize(size), SORT)),
                ProductDto::of);
    }

    /**
     * Picker for invoice lines: products without colours and every active colour, matched word by word
     * against the product name or the colour ("статус ақ" finds the white СТАТУС enamel).
     */
    @GetMapping("/options")
    @Transactional(readOnly = true)
    public List<ProductOption> options(@RequestParam(defaultValue = "") String q,
                                       @RequestParam(required = false) Long categoryId,
                                       @RequestParam(defaultValue = "30") int limit) {
        MapSqlParameterSource p = new MapSqlParameterSource("limit", Math.clamp(limit, 1, 100));
        List<String> cond = new ArrayList<>();
        String[] words = q.trim().toLowerCase().split("\\s+");
        for (int i = 0; i < words.length; i++) {
            if (words[i].isEmpty()) continue;
            cond.add("(lower(pr.name) like :w" + i + " or lower(coalesce(v.name, '')) like :w" + i + ")");
            p.addValue("w" + i, "%" + words[i] + "%");
        }
        if (categoryId != null) {
            cond.add("pr.category_id = :categoryId");
            p.addValue("categoryId", categoryId);
        }
        // Products with active colours are listed only by colour; the rest as themselves
        cond.add("(v.id is not null or not exists (select 1 from product_variant x where x.product_id = pr.id and x.active))");
        List<long[]> rows = jdbc.query("""
                select pr.id as pid, v.id as vid
                from product pr
                left join category c on c.id = pr.category_id
                left join product_variant v on v.product_id = pr.id and v.active
                where """ + String.join(" and ", cond) + """
                 order by c.sort_order nulls last, c.name nulls last, pr.sort_order nulls last, pr.name,
                          v.sort_order nulls last, v.id
                 limit :limit
                """, p, (rs, n) -> new long[] {rs.getLong("pid"), rs.getObject("vid") == null ? 0 : rs.getLong("vid")});

        Map<Long, Product> products = new HashMap<>();
        repo.findAllById(rows.stream().map(r -> r[0]).distinct().toList()).forEach(pr -> products.put(pr.getId(), pr));
        List<ProductOption> result = new ArrayList<>();
        for (long[] r : rows) {
            Product pr = products.get(r[0]);
            if (pr == null) continue;
            ProductVariant v = r[1] == 0 ? null
                    : pr.getVariants().stream().filter(x -> x.getId() == r[1]).findFirst().orElse(null);
            Category c = pr.getCategory();
            result.add(new ProductOption(pr.getId(), v == null ? null : v.getId(), lineName(pr, v), pr.getName(),
                    v == null ? null : v.getName(), v == null ? pr.getPrice() : v.effectivePrice(),
                    pr.getPackAmount(), pr.getPackUnit(), c == null ? null : c.getId(), c == null ? null : c.getName()));
        }
        return result;
    }

    @GetMapping("/{id}")
    @Transactional(readOnly = true)
    public ProductDto get(@PathVariable Long id) {
        return ProductDto.of(find(id));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public ProductDto create(@Valid @RequestBody ProductRequest req) {
        Product p = new Product();
        apply(p, req);
        return ProductDto.of(repo.save(p));
    }

    @PutMapping("/{id}")
    @Transactional
    public ProductDto update(@PathVariable Long id, @Valid @RequestBody ProductRequest req) {
        Product p = find(id);
        apply(p, req);
        repo.flush();
        return ProductDto.of(p);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void delete(@PathVariable Long id) {
        repo.delete(find(id));
    }

    /** Name written on an invoice line: the product, plus the colour when there is one. */
    public static String lineName(Product p, ProductVariant v) {
        return v == null ? p.getName() : p.getName() + " — " + v.getName();
    }

    private void apply(Product p, ProductRequest req) {
        p.setName(req.name().trim());
        p.setPrice(req.price());
        p.setSortOrder(req.sortOrder());
        p.setCategory(req.categoryId() == null ? null : categories.findById(req.categoryId())
                .orElseThrow(() -> new NotFoundException("error.category.notFound")));
        // Pack size is amount + unit together; one without the other is meaningless
        if (req.packAmount() != null && req.packUnit() == null) {
            throw new BadRequestException("error.product.packUnitRequired");
        }
        p.setPackAmount(req.packAmount() == null ? null : req.packAmount().setScale(3, RoundingMode.HALF_UP));
        p.setPackUnit(req.packAmount() == null ? null : req.packUnit());
        if (req.variants() != null) applyVariants(p, req.variants());
    }

    /** Replaces the colour list: updates known ids, adds new ones, removes the rest. */
    private void applyVariants(Product p, List<VariantRequest> requested) {
        Map<Long, ProductVariant> existing = new LinkedHashMap<>();
        p.getVariants().forEach(v -> existing.put(v.getId(), v));
        Set<String> names = new HashSet<>();
        List<ProductVariant> next = new ArrayList<>();
        int order = 0;
        for (VariantRequest r : requested) {
            String name = r.name().trim();
            if (!names.add(name.toLowerCase())) {
                throw new BadRequestException("error.colour.duplicate", name);
            }
            ProductVariant v = r.id() == null ? null : existing.get(r.id());
            if (r.id() != null && v == null) throw new NotFoundException("error.colour.notFound");
            if (v == null) {
                v = new ProductVariant();
                v.setProduct(p);
            }
            v.setName(name);
            v.setPrice(r.price());
            v.setActive(r.active() == null || r.active());
            v.setSortOrder(++order);
            next.add(v);
        }
        p.getVariants().clear();
        p.getVariants().addAll(next);
    }

    private Product find(Long id) {
        return repo.findById(id).orElseThrow(() -> new NotFoundException("error.product.notFound"));
    }
}
