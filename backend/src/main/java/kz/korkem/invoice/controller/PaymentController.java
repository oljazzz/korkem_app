package kz.korkem.invoice.controller;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.security.Principal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Arrays;
import java.util.List;
import kz.korkem.invoice.exception.BadRequestException;
import kz.korkem.invoice.properties.Messages;
import kz.korkem.invoice.exception.NotFoundException;
import kz.korkem.invoice.entities.Invoice;
import kz.korkem.invoice.entities.InvoiceLine;
import kz.korkem.invoice.entities.Payment;
import kz.korkem.invoice.enums.PaymentMethod;
import kz.korkem.invoice.repository.InvoiceRepository;
import kz.korkem.invoice.repository.PaymentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

/** Payments against an invoice. Deleting one is an admin action (DELETE /api/** is admin-only). */
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class PaymentController {

    private static final ZoneId ZONE = ZoneId.of("Asia/Almaty");

    public record PaymentDto(Long id, Long invoiceId, BigDecimal amount, LocalDate paidOn, PaymentMethod method,
                             String methodLabel, String note, String createdBy, Instant createdAt) {
        static PaymentDto of(Payment p, Messages messages) {
            return new PaymentDto(p.getId(), p.getInvoice().getId(), p.getAmount(), p.getPaidOn(), p.getMethod(),
                    messages.label("paymentMethod", p.getMethod()), p.getNote(), p.getCreatedBy(), p.getCreatedAt());
        }
    }

    public record PaymentRequest(
            @NotNull(message = "{validation.amount.required}") @DecimalMin(value = "0.01", message = "{validation.amount.positive}") BigDecimal amount,
            LocalDate paidOn,
            PaymentMethod method,
            @Size(max = 500, message = "{validation.note.tooLong}") String note) {}

    public record MethodDto(PaymentMethod value, String label) {}

    private final PaymentRepository payments;
    private final InvoiceRepository invoices;
    private final Messages messages;

    @GetMapping("/payments/methods")
    public List<MethodDto> methods() {
        return Arrays.stream(PaymentMethod.values()).map(m -> new MethodDto(m, messages.label("paymentMethod", m))).toList();
    }

    @GetMapping("/invoices/{invoiceId}/payments")
    public List<PaymentDto> list(@PathVariable Long invoiceId) {
        findInvoice(invoiceId);
        return payments.findByInvoiceIdOrderByPaidOnAscIdAsc(invoiceId).stream().map(p -> PaymentDto.of(p, messages)).toList();
    }

    @PostMapping("/invoices/{invoiceId}/payments")
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public PaymentDto add(@PathVariable Long invoiceId, @Valid @RequestBody PaymentRequest req, Principal principal) {
        Invoice invoice = findInvoice(invoiceId);
        if (invoice.isLegacyPaid()) {
            throw new BadRequestException("error.payment.legacyPaid");
        }
        LocalDate today = LocalDate.now(ZONE);
        LocalDate paidOn = req.paidOn() == null ? today : req.paidOn();
        if (paidOn.isAfter(today)) {
            throw new BadRequestException("error.payment.futureDate");
        }
        BigDecimal amount = req.amount().setScale(2, RoundingMode.HALF_UP);
        BigDecimal total = invoice.getLines().stream().map(InvoiceLine::getTotal).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal due = total.subtract(payments.paidFor(invoiceId));
        if (amount.compareTo(due) > 0) {
            throw new BadRequestException("error.payment.exceedsDue", due.max(BigDecimal.ZERO).toPlainString());
        }
        Payment p = new Payment();
        p.setInvoice(invoice);
        p.setAmount(amount);
        p.setPaidOn(paidOn);
        p.setMethod(req.method() == null ? PaymentMethod.CASH : req.method());
        p.setNote(req.note() == null || req.note().isBlank() ? null : req.note().trim());
        p.setCreatedBy(principal == null ? null : principal.getName());
        p.setCreatedAt(Instant.now());
        return PaymentDto.of(payments.save(p), messages);
    }

    @DeleteMapping("/payments/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void delete(@PathVariable Long id) {
        payments.delete(payments.findById(id).orElseThrow(() -> new NotFoundException("error.payment.notFound")));
    }

    private Invoice findInvoice(Long id) {
        return invoices.findWithLines(id).orElseThrow(() -> new NotFoundException("error.invoice.notFound"));
    }
}
