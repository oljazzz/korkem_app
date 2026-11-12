package kz.korkem.invoice.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import kz.korkem.invoice.enums.PackUnit;
import kz.korkem.invoice.enums.PaymentStatus;
import kz.korkem.invoice.enums.Unit;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public final class InvoiceDtos {
    private InvoiceDtos() {}

    /** {@code clientName} is the short label (no phone numbers); {@code clientPlace} the town or address. */
    public record InvoiceListItem(Long id, Long number, Long clientId, String clientName, String clientPlace,
                                  Instant createdAt, BigDecimal total, BigDecimal paid, BigDecimal due,
                                  PaymentStatus status) {}

    public record UnitDto(Unit value, String label) {}

    /** Totals over every invoice that matches the list filters, not just the current page. */
    public record InvoiceSummary(long count, BigDecimal total, BigDecimal due) {}

    public record LineDto(Long id, Long categoryId, String categoryName, Long productId, Long variantId, String productName,
                          Unit unit, String unitLabel, BigDecimal price, BigDecimal quantity,
                          BigDecimal discount, BigDecimal total, BigDecimal vat, Integer sortOrder,
                          /** Pack size of the product (2.6 kg, 0.9 l), for the weight on the printed invoice. */
                          BigDecimal packAmount, PackUnit packUnit) {}

    /** {@code clientName} is the full "name - address" printed on documents; {@code clientLabel} the short one. */
    public record InvoiceDto(Long id, Long number, Long clientId, String clientName, String clientLabel, Instant createdAt,
                             String createdBy, List<LineDto> lines, BigDecimal total, BigDecimal vat,
                             BigDecimal paid, BigDecimal due, PaymentStatus status, boolean legacyPaid) {}

    public record LineRequest(
            Long categoryId,
            Long productId,
            /** Colour of the product; required when the product has colours. */
            Long variantId,
            String productName,
            Unit unit,
            @NotNull(message = "{validation.price.required}") @DecimalMin(value = "0", message = "{validation.price.negative}") BigDecimal price,
            @NotNull(message = "{validation.quantity.required}") @DecimalMin(value = "0", inclusive = false, message = "{validation.quantity.positive}") BigDecimal quantity,
            @DecimalMin(value = "0", message = "{validation.discount.range}") @DecimalMax(value = "100", message = "{validation.discount.range}") BigDecimal discount,
            Integer sortOrder) {}

    /** {@code date} is the document date (Almaty calendar day); null keeps the current one, or today for a new invoice. */
    public record InvoiceRequest(
            @NotNull(message = "{validation.client.required}") Long clientId,
            LocalDate date,
            @NotEmpty(message = "{validation.lines.required}") List<@Valid LineRequest> lines) {}
}
