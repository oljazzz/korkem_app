package kz.korkem.invoice.service;

import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import kz.korkem.invoice.dto.PageResponse;
import kz.korkem.invoice.dto.ProductDtos.ProductDto;
import kz.korkem.invoice.dto.ProductDtos.ProductOption;
import kz.korkem.invoice.dto.ProductDtos.ProductRequest;
import kz.korkem.invoice.dto.ProductDtos.VariantRequest;
import kz.korkem.invoice.entities.Product;
import kz.korkem.invoice.entities.ProductVariant;
import kz.korkem.invoice.exception.BadRequestException;
import kz.korkem.invoice.exception.NotFoundException;
import kz.korkem.invoice.mapper.ProductMapper;
import kz.korkem.invoice.repository.CategoryRepository;
import kz.korkem.invoice.repository.ProductRepository;
import kz.korkem.invoice.repository.query.ProductOptionQuery;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** The price list: products, their pack size and colours. */
@Service
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class ProductService {

    private static final Sort SORT = Sort.by(
            Sort.Order.asc("category.sortOrder").nullsLast(), Sort.Order.asc("category.name").nullsLast(),
            Sort.Order.asc("sortOrder").nullsLast(), Sort.Order.asc("name"));
    private static final int MAX_OPTIONS = 100;

    private final ProductRepository products;
    private final CategoryRepository categories;
    private final ProductOptionQuery optionQuery;
    private final ProductMapper mapper;

    public PageResponse<ProductDto> search(String q, Long categoryId, int page, int size) {
        return PageResponse.of(products.search(q.trim(), categoryId, PageRequest.of(page, PageResponse.clampSize(size), SORT)),
                mapper::toDto);
    }

    /** Choices for an invoice line: products without colours and each active colour. */
    public List<ProductOption> options(String q, Long categoryId, int limit) {
        var rows = optionQuery.find(q, categoryId, Math.clamp(limit, 1, MAX_OPTIONS));
        Map<Long, Product> byId = products.findAllById(rows.stream().map(ProductOptionQuery.Row::productId).distinct().toList())
                .stream().collect(Collectors.toMap(Product::getId, Function.identity()));
        List<ProductOption> result = new ArrayList<>();
        for (var row : rows) {
            Product p = byId.get(row.productId());
            if (p == null) continue;
            ProductVariant variant = row.variantId() == null ? null
                    : p.getVariants().stream().filter(v -> Objects.equals(v.getId(), row.variantId())).findFirst().orElse(null);
            result.add(mapper.toOption(p, variant));
        }
        return result;
    }

    public ProductDto get(Long id) {
        return mapper.toDto(find(id));
    }

    @Transactional
    public ProductDto create(ProductRequest req) {
        Product p = new Product();
        apply(p, req);
        return mapper.toDto(products.save(p));
    }

    @Transactional
    public ProductDto update(Long id, ProductRequest req) {
        Product p = find(id);
        apply(p, req);
        products.flush();
        return mapper.toDto(p);
    }

    @Transactional
    public void delete(Long id) {
        products.delete(find(id));
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
    private static void applyVariants(Product p, List<VariantRequest> requested) {
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
        return products.findById(id).orElseThrow(() -> new NotFoundException("error.product.notFound"));
    }
}
