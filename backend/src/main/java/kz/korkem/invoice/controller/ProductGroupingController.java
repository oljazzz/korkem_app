package kz.korkem.invoice.controller;

import jakarta.validation.Valid;
import java.util.List;
import kz.korkem.invoice.dto.ProductDtos.GroupRequest;
import kz.korkem.invoice.dto.ProductDtos.GroupResult;
import kz.korkem.invoice.dto.ProductDtos.GroupSuggestion;
import kz.korkem.invoice.service.ProductGroupingService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

/** Grouping colour families into one product. POST is admin-only (SecurityConfig): it deletes products. */
@RestController
@RequestMapping("/api/products")
@RequiredArgsConstructor
public class ProductGroupingController {

    private final ProductGroupingService grouping;

    @GetMapping("/grouping")
    public List<GroupSuggestion> suggestions() {
        return grouping.suggestions();
    }

    @PostMapping("/group")
    public GroupResult group(@Valid @RequestBody GroupRequest req) {
        return grouping.group(req.name(), req.members());
    }
}
