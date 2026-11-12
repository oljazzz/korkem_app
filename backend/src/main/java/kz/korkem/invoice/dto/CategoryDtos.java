package kz.korkem.invoice.dto;

import jakarta.validation.constraints.NotBlank;

/** Request and response bodies of /api/categories. */
public final class CategoryDtos {

    private CategoryDtos() {}

    public record CategoryDto(Long id, String name, Integer sortOrder) {}

    public record CategoryRequest(@NotBlank(message = "{validation.name.required}") String name, Integer sortOrder) {}
}
