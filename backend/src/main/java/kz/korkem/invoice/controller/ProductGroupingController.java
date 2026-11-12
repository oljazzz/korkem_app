package kz.korkem.invoice.controller;

import jakarta.validation.Valid;
import java.util.List;
import kz.korkem.invoice.dto.ProductDtos.GroupRequest;
import kz.korkem.invoice.dto.ProductDtos.GroupResult;
import kz.korkem.invoice.dto.ProductDtos.GroupSuggestion;
import kz.korkem.invoice.service.ProductGroupingService;
import kz.korkem.invoice.security.AdminOnly;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

/** Grouping colour families into one product. Grouping deletes products, so it is admin-only. */
@RestController
@RequestMapping("/api/products")
@RequiredArgsConstructor
public class ProductGroupingController {

    private final ProductGroupingService grouping;

    @GetMapping("/grouping")
    public List<GroupSuggestion> suggestions() {
        return grouping.suggestions();
    }

    @AdminOnly
    @PostMapping("/group")
    public GroupResult group(@Valid @RequestBody GroupRequest req) {
        return grouping.group(req.name(), req.members());
    }
}
