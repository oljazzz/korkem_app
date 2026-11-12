package kz.korkem.invoice.controller;

import jakarta.validation.Valid;
import java.util.List;
import kz.korkem.invoice.dto.CategoryDtos.CategoryDto;
import kz.korkem.invoice.dto.CategoryDtos.CategoryRequest;
import kz.korkem.invoice.dto.PageResponse;
import kz.korkem.invoice.service.CategoryService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/categories")
@RequiredArgsConstructor
public class CategoryController {

    private final CategoryService categories;

    @GetMapping
    public PageResponse<CategoryDto> list(@RequestParam(defaultValue = "") String q,
                                          @RequestParam(defaultValue = "0") int page,
                                          @RequestParam(defaultValue = "50") int size) {
        return categories.search(q, page, size);
    }

    /** All categories, for select inputs. */
    @GetMapping("/all")
    public List<CategoryDto> all() {
        return categories.all();
    }

    @GetMapping("/{id}")
    public CategoryDto get(@PathVariable Long id) {
        return categories.get(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public CategoryDto create(@Valid @RequestBody CategoryRequest req) {
        return categories.create(req);
    }

    @PutMapping("/{id}")
    public CategoryDto update(@PathVariable Long id, @Valid @RequestBody CategoryRequest req) {
        return categories.update(id, req);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        categories.delete(id);
    }
}
