package kz.korkem.invoice.invoice;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public final class InvoiceDtos {
    private InvoiceDtos() {}

    public record InvoiceListItem(Long id, Long number, Long clientId, String clientName, Instant createdAt,
                                  BigDecimal total) {}

    public record LineDto(Long id, Long categoryId, String categoryName, Long productId, String productName,
                          Unit unit, String unitLabel, BigDecimal price, BigDecimal quantity,
                          BigDecimal discount, BigDecimal total, BigDecimal vat, Integer sortOrder) {}

    public record InvoiceDto(Long id, Long number, Long clientId, String clientName, Instant createdAt,
                             String createdBy, List<LineDto> lines, BigDecimal total, BigDecimal vat) {}

    public record LineRequest(
            Long categoryId,
            Long productId,
            String productName,
            Unit unit,
            @NotNull(message = "Бағасын енгізіңіз") @DecimalMin(value = "0", message = "Баға теріс болмауы керек") BigDecimal price,
            @NotNull(message = "Санын енгізіңіз") @DecimalMin(value = "0", inclusive = false, message = "Саны 0-ден көп болуы керек") BigDecimal quantity,
            @DecimalMin(value = "0", message = "Жеңілдік 0..100") @DecimalMax(value = "100", message = "Жеңілдік 0..100") BigDecimal discount,
            Integer sortOrder) {}

    public record InvoiceRequest(
            @NotNull(message = "Клиентті таңдаңыз") Long clientId,
            @NotEmpty(message = "Кемінде бір тауар қосыңыз") List<@Valid LineRequest> lines) {}
}
