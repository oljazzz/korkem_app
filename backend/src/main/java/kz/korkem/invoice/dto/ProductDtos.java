package kz.korkem.invoice.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.util.List;
import kz.korkem.invoice.enums.PackUnit;

/** Request and response bodies of /api/products, including colour grouping. */
public final class ProductDtos {

    private ProductDtos() {}

    public record VariantDto(Long id, String name, BigDecimal price, boolean active, Integer sortOrder) {}

    public record ProductDto(Long id, Long categoryId, String categoryName, String name,
                             BigDecimal price, Integer sortOrder, BigDecimal packAmount, PackUnit packUnit,
                             List<VariantDto> variants) {}

    /** {@code id} null for a new colour; colours left out of the list are removed. */
    public record VariantRequest(
            Long id,
            @NotBlank(message = "{validation.colour.name.required}") @Size(max = 255, message = "{validation.tooLong}") String name,
            @DecimalMin(value = "0", message = "{validation.price.negative}") BigDecimal price,
            Boolean active) {}

    public record ProductRequest(
            Long categoryId,
            @NotBlank(message = "{validation.name.required}") @Size(max = 255, message = "{validation.name.tooLong}") String name,
            @NotNull(message = "{validation.price.required}") @DecimalMin(value = "0", message = "{validation.price.negative}") BigDecimal price,
            Integer sortOrder,
            @DecimalMin(value = "0.001", message = "{validation.pack.positive}")
            @DecimalMax(value = "999999", message = "{validation.pack.tooLarge}") BigDecimal packAmount,
            PackUnit packUnit,
            List<@Valid VariantRequest> variants) {}

    /**
     * One thing that can go on an invoice line: a product without colours, or one colour of a product.
     * {@code label} is the full line name ("СТАТУС ПФ-115 2,6 кг — Ақ").
     */
    public record ProductOption(Long productId, Long variantId, String label, String productName, String variantName,
                                BigDecimal price, BigDecimal packAmount, PackUnit packUnit,
                                Long categoryId, String categoryName) {}

    // --- grouping colour families into one product ---

    public record GroupMember(Long productId, String name, String variantName, BigDecimal price, long invoiceLines) {}

    /** {@code duplicates}: the names differ only in spelling, so they are one product, not colours. */
    public record GroupSuggestion(String name, Long categoryId, String categoryName, BigDecimal price,
                                  BigDecimal packAmount, PackUnit packUnit, boolean duplicates, List<GroupMember> members) {}

    /** A product to merge and the colour it becomes (blank when merging spelling duplicates). */
    public record GroupMemberRequest(Long productId, String variantName) {}

    public record GroupRequest(@NotBlank(message = "{validation.product.name.required}") String name,
                               @NotEmpty(message = "{validation.products.required}") List<GroupMemberRequest> members) {}

    public record GroupResult(ProductDto product, int variants, int removedProducts, int movedLines) {}
}
