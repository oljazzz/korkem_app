package kz.korkem.invoice.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import kz.korkem.invoice.enums.PaymentMethod;

/** Request and response bodies of payments. */
public final class PaymentDtos {

    private PaymentDtos() {}

    public record PaymentDto(Long id, Long invoiceId, BigDecimal amount, LocalDate paidOn, PaymentMethod method,
                             String methodLabel, String note, String createdBy, Instant createdAt) {}

    public record PaymentRequest(
            @NotNull(message = "{validation.amount.required}") @DecimalMin(value = "0.01", message = "{validation.amount.positive}") BigDecimal amount,
            LocalDate paidOn,
            PaymentMethod method,
            @Size(max = 500, message = "{validation.note.tooLong}") String note) {}

}
