package kz.korkem.invoice.controller;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import java.util.List;
import kz.korkem.invoice.controller.ProductController.ProductDto;
import kz.korkem.invoice.service.ProductGroupingService;
import kz.korkem.invoice.service.ProductGroupingService.MemberRequest;
import kz.korkem.invoice.service.ProductGroupingService.Suggestion;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

/** Grouping color families into one product. POST is admin-only (SecurityConfig): it deletes products. */
@RestController
@RequestMapping("/api/products")
@RequiredArgsConstructor
public class ProductGroupingController {

    public record GroupRequest(@NotBlank(message = "{validation.product.name.required}") String name,
                               @NotEmpty(message = "{validation.products.required}") List<MemberRequest> members) {}

    public record GroupResult(ProductDto product, int variants, int removedProducts, int movedLines) {}

    private final ProductGroupingService service;

    @GetMapping("/grouping")
    public List<Suggestion> suggestions() {
        return service.suggestions();
    }

    @PostMapping("/group")
    @org.springframework.transaction.annotation.Transactional
    public GroupResult group(@Valid @RequestBody GroupRequest req) {
        var r = service.group(req.name(), req.members());
        return new GroupResult(ProductDto.of(r.product()), r.variants(), r.removedProducts(), r.movedLines());
    }
}
