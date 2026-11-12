package kz.korkem.invoice.controller;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import java.util.List;

import kz.korkem.invoice.entities.Category;
import kz.korkem.invoice.exception.NotFoundException;
import kz.korkem.invoice.dto.PageResponse;
import kz.korkem.invoice.repository.CategoryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/categories")
@RequiredArgsConstructor
public class CategoryController {

    public record CategoryDto(Long id, String name, Integer sortOrder) {
        static CategoryDto of(Category c) {
            return new CategoryDto(c.getId(), c.getName(), c.getSortOrder());
        }
    }

    public record CategoryRequest(@NotBlank(message = "{validation.name.required}") String name, Integer sortOrder) {}

    private static final Sort SORT = Sort.by(Sort.Order.asc("sortOrder").nullsLast(), Sort.Order.asc("name"));

    private final CategoryRepository repo;

    @GetMapping
    public PageResponse<CategoryDto> list(@RequestParam(defaultValue = "") String q,
                                          @RequestParam(defaultValue = "0") int page,
                                          @RequestParam(defaultValue = "50") int size) {
        return PageResponse.of(repo.findByNameContainingIgnoreCase(q.trim(),
                PageRequest.of(page, PageResponse.clampSize(size), SORT)), CategoryDto::of);
    }

    /** All categories, for select inputs. */
    @GetMapping("/all")
    public List<CategoryDto> all() {
        return repo.findAll(SORT).stream().map(CategoryDto::of).toList();
    }

    @GetMapping("/{id}")
    public CategoryDto get(@PathVariable Long id) {
        return CategoryDto.of(find(id));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public CategoryDto create(@Valid @RequestBody CategoryRequest req) {
        Category c = new Category();
        apply(c, req);
        return CategoryDto.of(repo.save(c));
    }

    @PutMapping("/{id}")
    @Transactional
    public CategoryDto update(@PathVariable Long id, @Valid @RequestBody CategoryRequest req) {
        Category c = find(id);
        apply(c, req);
        return CategoryDto.of(c);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void delete(@PathVariable Long id) {
        repo.delete(find(id));
    }

    private void apply(Category c, CategoryRequest req) {
        c.setName(req.name().trim());
        c.setSortOrder(req.sortOrder());
    }

    private Category find(Long id) {
        return repo.findById(id).orElseThrow(() -> new NotFoundException("error.category.notFound"));
    }
}
