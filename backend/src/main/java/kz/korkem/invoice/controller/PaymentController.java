package kz.korkem.invoice.controller;

import jakarta.validation.Valid;
import java.security.Principal;
import java.util.List;
import kz.korkem.invoice.dto.PaymentDtos.PaymentDto;
import kz.korkem.invoice.dto.PaymentDtos.PaymentRequest;
import kz.korkem.invoice.service.PaymentService;
import kz.korkem.invoice.security.AdminOnly;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

/** Payments against an invoice. */
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class PaymentController {

    private final PaymentService payments;

    @GetMapping("/invoices/{invoiceId}/payments")
    public List<PaymentDto> list(@PathVariable Long invoiceId) {
        return payments.forInvoice(invoiceId);
    }

    @PostMapping("/invoices/{invoiceId}/payments")
    @ResponseStatus(HttpStatus.CREATED)
    public PaymentDto add(@PathVariable Long invoiceId, @Valid @RequestBody PaymentRequest req, Principal principal) {
        return payments.add(invoiceId, req, principal.getName());
    }

    @AdminOnly
    @DeleteMapping("/payments/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        payments.delete(id);
    }
}
