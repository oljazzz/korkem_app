package kz.korkem.invoice.mapper;

import kz.korkem.invoice.dto.CategoryDtos.CategoryDto;
import kz.korkem.invoice.entities.Category;
import kz.korkem.invoice.util.Snapshot;
import org.springframework.stereotype.Component;

@Component
public class CategoryMapper {

    public CategoryDto toDto(Category c) {
        return new CategoryDto(c.getId(), c.getName(), c.getSortOrder());
    }

    public Snapshot audit(Category c) {
        return Snapshot.of().put("name", c.getName());
    }
}
