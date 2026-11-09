package kz.korkem.invoice.product;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import kz.korkem.invoice.category.Category;
import kz.korkem.invoice.category.CategoryRepository;
import kz.korkem.invoice.common.NotFoundException;
import kz.korkem.invoice.common.PageResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/products")
@RequiredArgsConstructor
public class ProductController {

    public record ProductDto(Long id, Long categoryId, String categoryName, String name,
                             BigDecimal price, Integer sortOrder, BigDecimal packAmount, PackUnit packUnit) {
        static ProductDto of(Product p) {
            Category c = p.getCategory();
            return new ProductDto(p.getId(), c == null ? null : c.getId(), c == null ? null : c.getName(),
                    p.getName(), p.getPrice(), p.getSortOrder(), p.getPackAmount(), p.getPackUnit());
        }
    }

    public record ProductRequest(
            Long categoryId,
            @NotBlank(message = "Атауын енгізіңіз") @Size(max = 255, message = "Атауы тым ұзын (255 таңбадан аспасын)") String name,
            @NotNull(message = "Бағасын енгізіңіз") @DecimalMin(value = "0", message = "Баға теріс болмауы керек") BigDecimal price,
            Integer sortOrder,
            @DecimalMin(value = "0.001", message = "Қаптама 0-ден көп болуы керек")
            @jakarta.validation.constraints.DecimalMax(value = "999999", message = "Қаптама тым үлкен") BigDecimal packAmount,
            PackUnit packUnit) {}

    private static final Sort SORT = Sort.by(
            Sort.Order.asc("category.sortOrder").nullsLast(), Sort.Order.asc("category.name").nullsLast(),
            Sort.Order.asc("sortOrder").nullsLast(), Sort.Order.asc("name"));

    private final ProductRepository repo;
    private final CategoryRepository categories;

    @GetMapping
    @Transactional(readOnly = true)
    public PageResponse<ProductDto> list(@RequestParam(defaultValue = "") String q,
                                         @RequestParam(required = false) Long categoryId,
                                         @RequestParam(defaultValue = "0") int page,
                                         @RequestParam(defaultValue = "50") int size) {
        return PageResponse.of(repo.search(q.trim(), categoryId, PageRequest.of(page, PageResponse.clampSize(size), SORT)),
                ProductDto::of);
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
        return ProductDto.of(p);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void delete(@PathVariable Long id) {
        repo.delete(find(id));
    }

    private void apply(Product p, ProductRequest req) {
        p.setName(req.name().trim());
        p.setPrice(req.price());
        p.setSortOrder(req.sortOrder());
        // Pack size is amount + unit together; one without the other is meaningless
        if (req.packAmount() != null && req.packUnit() == null) {
            throw new kz.korkem.invoice.common.BadRequestException("Қаптаманың бірлігін таңдаңыз (кг немесе л)");
        }
        p.setPackAmount(req.packAmount() == null ? null : req.packAmount().setScale(3, java.math.RoundingMode.HALF_UP));
        p.setPackUnit(req.packAmount() == null ? null : req.packUnit());
        p.setCategory(req.categoryId() == null ? null : categories.findById(req.categoryId())
                .orElseThrow(() -> new NotFoundException("Санат табылмады")));
    }

    private Product find(Long id) {
        return repo.findById(id).orElseThrow(() -> new NotFoundException("Тауар табылмады"));
    }
}
