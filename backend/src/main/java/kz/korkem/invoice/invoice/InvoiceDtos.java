package kz.korkem.invoice.invoice;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
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

    /** Totals over every invoice that matches the list filters, not just the current page. */
    public record InvoiceSummary(long count, BigDecimal total, BigDecimal due) {}

    public record LineDto(Long id, Long categoryId, String categoryName, Long productId, String productName,
                          Unit unit, String unitLabel, BigDecimal price, BigDecimal quantity,
                          BigDecimal discount, BigDecimal total, BigDecimal vat, Integer sortOrder) {}

    /** {@code clientName} is the full "name - address" printed on documents; {@code clientLabel} the short one. */
    public record InvoiceDto(Long id, Long number, Long clientId, String clientName, String clientLabel, Instant createdAt,
                             String createdBy, List<LineDto> lines, BigDecimal total, BigDecimal vat,
                             BigDecimal paid, BigDecimal due, PaymentStatus status, boolean legacyPaid) {}

    public record LineRequest(
            Long categoryId,
            Long productId,
            String productName,
            Unit unit,
            @NotNull(message = "Бағасын енгізіңіз") @DecimalMin(value = "0", message = "Баға теріс болмауы керек") BigDecimal price,
            @NotNull(message = "Санын енгізіңіз") @DecimalMin(value = "0", inclusive = false, message = "Саны 0-ден көп болуы керек") BigDecimal quantity,
            @DecimalMin(value = "0", message = "Жеңілдік 0..100") @DecimalMax(value = "100", message = "Жеңілдік 0..100") BigDecimal discount,
            Integer sortOrder) {}

    /** {@code date} is the document date (Almaty calendar day); null keeps the current one, or today for a new invoice. */
    public record InvoiceRequest(
            @NotNull(message = "Клиентті таңдаңыз") Long clientId,
            LocalDate date,
            @NotEmpty(message = "Кемінде бір тауар қосыңыз") List<@Valid LineRequest> lines) {}
}
