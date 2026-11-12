package kz.korkem.invoice.controller;

import kz.korkem.invoice.dto.ClientDtos.ClientSummary;
import kz.korkem.invoice.dto.ClientDtos.Debts;
import kz.korkem.invoice.dto.InvoiceDtos.InvoiceDto;
import kz.korkem.invoice.service.ClientActivityService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

/** What clients bought and owe. */
@RestController
@RequestMapping("/api/clients")
@RequiredArgsConstructor
public class ClientActivityController {

    private final ClientActivityService activity;

    /** Clients that owe money, largest first. */
    @GetMapping("/debtors")
    public Debts debtors(@RequestParam(defaultValue = "50") int limit) {
        return activity.debtors(limit);
    }

    /** The client card: debt, totals, recent invoices, most bought products. */
    @GetMapping("/{id}/summary")
    public ClientSummary summary(@PathVariable Long id) {
        return activity.summary(id);
    }

    /** 404 when the client has no invoices yet. */
    @GetMapping("/{id}/last-invoice")
    public InvoiceDto lastInvoice(@PathVariable Long id) {
        return activity.lastInvoice(id);
    }
}
