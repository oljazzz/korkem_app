package kz.korkem.invoice.service;

import kz.korkem.invoice.enums.AuditEntityType;
import java.util.List;
import kz.korkem.invoice.dto.CategoryDtos.CategoryDto;
import kz.korkem.invoice.dto.CategoryDtos.CategoryRequest;
import kz.korkem.invoice.dto.PageResponse;
import kz.korkem.invoice.entities.Category;
import kz.korkem.invoice.exception.NotFoundException;
import kz.korkem.invoice.mapper.CategoryMapper;
import kz.korkem.invoice.repository.CategoryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Product categories: the groups of the price list. */
@Service
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class CategoryService {

    private static final Sort SORT = Sort.by(Sort.Order.asc("sortOrder").nullsLast(), Sort.Order.asc("name"));

    private final CategoryRepository categories;
    private final CategoryMapper mapper;
    private final AuditService audit;

    public PageResponse<CategoryDto> search(String q, int page, int size) {
        return PageResponse.of(categories.findByNameContainingIgnoreCase(q.trim(),
                PageRequest.of(page, PageResponse.clampSize(size), SORT)), mapper::toDto);
    }

    public List<CategoryDto> all() {
        return categories.findAll(SORT).stream().map(mapper::toDto).toList();
    }

    public CategoryDto get(Long id) {
        return mapper.toDto(find(id));
    }

    @Transactional
    public CategoryDto create(CategoryRequest req) {
        Category c = new Category();
        apply(c, req);
        categories.save(c);
        audit.created(AuditEntityType.CATEGORY, c.getId(), c.getName(), mapper.audit(c));
        return mapper.toDto(c);
    }

    @Transactional
    public CategoryDto update(Long id, CategoryRequest req) {
        Category c = find(id);
        var before = mapper.audit(c);
        apply(c, req);
        audit.updated(AuditEntityType.CATEGORY, id, c.getName(), before, mapper.audit(c));
        return mapper.toDto(c);
    }

    @Transactional
    public void delete(Long id) {
        Category c = find(id);
        categories.delete(c);
        audit.deleted(AuditEntityType.CATEGORY, id, c.getName(), mapper.audit(c));
    }

    private static void apply(Category c, CategoryRequest req) {
        c.setName(req.name().trim());
        c.setSortOrder(req.sortOrder());
    }

    private Category find(Long id) {
        return categories.findById(id).orElseThrow(() -> new NotFoundException("error.category.notFound"));
    }
}
