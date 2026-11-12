package kz.korkem.invoice.controller;

import jakarta.validation.Valid;
import java.security.Principal;
import java.util.List;
import kz.korkem.invoice.dto.PaymentDtos.MethodDto;
import kz.korkem.invoice.dto.PaymentDtos.PaymentDto;
import kz.korkem.invoice.dto.PaymentDtos.PaymentRequest;
import kz.korkem.invoice.service.PaymentService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

/** Payments against an invoice. Deleting one is an admin action (DELETE /api/** is admin-only). */
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class PaymentController {

    private final PaymentService payments;

    @GetMapping("/payments/methods")
    public List<MethodDto> methods() {
        return payments.methods();
    }

    @GetMapping("/invoices/{invoiceId}/payments")
    public List<PaymentDto> list(@PathVariable Long invoiceId) {
        return payments.forInvoice(invoiceId);
    }

    @PostMapping("/invoices/{invoiceId}/payments")
    @ResponseStatus(HttpStatus.CREATED)
    public PaymentDto add(@PathVariable Long invoiceId, @Valid @RequestBody PaymentRequest req, Principal principal) {
        return payments.add(invoiceId, req, principal == null ? null : principal.getName());
    }

    @DeleteMapping("/payments/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        payments.delete(id);
    }
}
