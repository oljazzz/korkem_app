package kz.korkem.invoice.service;

import static kz.korkem.invoice.constants.DateProps.ZONE;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.List;
import kz.korkem.invoice.dto.PaymentDtos.MethodDto;
import kz.korkem.invoice.dto.PaymentDtos.PaymentDto;
import kz.korkem.invoice.dto.PaymentDtos.PaymentRequest;
import kz.korkem.invoice.entities.Invoice;
import kz.korkem.invoice.entities.InvoiceLine;
import kz.korkem.invoice.entities.Payment;
import kz.korkem.invoice.enums.PaymentMethod;
import kz.korkem.invoice.exception.BadRequestException;
import kz.korkem.invoice.exception.NotFoundException;
import kz.korkem.invoice.mapper.PaymentMapper;
import kz.korkem.invoice.repository.InvoiceRepository;
import kz.korkem.invoice.repository.PaymentRepository;
import kz.korkem.invoice.util.Texts;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Money taken against an invoice. A payment may not exceed what is still owed, may not be dated in the
 * future, and invoices from before payments were tracked count as paid and take none.
 */
@Service
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class PaymentService {

    private final PaymentRepository payments;
    private final InvoiceRepository invoices;
    private final PaymentMapper mapper;

    public List<MethodDto> methods() {
        return Arrays.stream(PaymentMethod.values()).map(mapper::toDto).toList();
    }

    public List<PaymentDto> forInvoice(Long invoiceId) {
        findInvoice(invoiceId);
        return payments.findByInvoiceIdOrderByPaidOnAscIdAsc(invoiceId).stream().map(mapper::toDto).toList();
    }

    @Transactional
    public PaymentDto add(Long invoiceId, PaymentRequest req, String username) {
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
        BigDecimal due = due(invoice);
        if (amount.compareTo(due) > 0) {
            throw new BadRequestException("error.payment.exceedsDue", due.max(BigDecimal.ZERO).toPlainString());
        }
        Payment p = new Payment();
        p.setInvoice(invoice);
        p.setAmount(amount);
        p.setPaidOn(paidOn);
        p.setMethod(req.method() == null ? PaymentMethod.CASH : req.method());
        p.setNote(Texts.clean(req.note()));
        p.setCreatedBy(username);
        p.setCreatedAt(Instant.now());
        return mapper.toDto(payments.save(p));
    }

    @Transactional
    public void delete(Long id) {
        payments.delete(payments.findById(id).orElseThrow(() -> new NotFoundException("error.payment.notFound")));
    }

    /** Invoice total minus what has been paid so far (negative if overpaid). */
    private BigDecimal due(Invoice invoice) {
        BigDecimal total = invoice.getLines().stream().map(InvoiceLine::getTotal).reduce(BigDecimal.ZERO, BigDecimal::add);
        return total.subtract(payments.paidFor(invoice.getId()));
    }

    private Invoice findInvoice(Long id) {
        return invoices.findWithLines(id).orElseThrow(() -> new NotFoundException("error.invoice.notFound"));
    }
}
