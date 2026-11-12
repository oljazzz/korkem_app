package kz.korkem.invoice.controller;

import jakarta.validation.Valid;
import java.util.List;
import kz.korkem.invoice.dto.PageResponse;
import kz.korkem.invoice.dto.ProductDtos.ProductDto;
import kz.korkem.invoice.dto.ProductDtos.ProductOption;
import kz.korkem.invoice.dto.ProductDtos.ProductRequest;
import kz.korkem.invoice.service.ProductService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/products")
@RequiredArgsConstructor
public class ProductController {

    private final ProductService products;

    @GetMapping
    public PageResponse<ProductDto> list(@RequestParam(defaultValue = "") String q,
                                         @RequestParam(required = false) Long categoryId,
                                         @RequestParam(defaultValue = "0") int page,
                                         @RequestParam(defaultValue = "50") int size) {
        return products.search(q, categoryId, page, size);
    }

    /** Picker for invoice lines, matched word by word ("статус ақ"). */
    @GetMapping("/options")
    public List<ProductOption> options(@RequestParam(defaultValue = "") String q,
                                       @RequestParam(required = false) Long categoryId,
                                       @RequestParam(defaultValue = "30") int limit) {
        return products.options(q, categoryId, limit);
    }

    @GetMapping("/{id}")
    public ProductDto get(@PathVariable Long id) {
        return products.get(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ProductDto create(@Valid @RequestBody ProductRequest req) {
        return products.create(req);
    }

    @PutMapping("/{id}")
    public ProductDto update(@PathVariable Long id, @Valid @RequestBody ProductRequest req) {
        return products.update(id, req);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        products.delete(id);
    }
}
