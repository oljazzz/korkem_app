package kz.korkem.invoice.controller;

import kz.korkem.invoice.dto.ClientDtos.ClientSummary;
import kz.korkem.invoice.dto.ClientDtos.Debts;
import kz.korkem.invoice.dto.InvoiceDtos.InvoiceDto;
import java.time.LocalDate;
import kz.korkem.invoice.dto.ReconciliationDtos.Reconciliation;
import kz.korkem.invoice.service.ClientActivityService;
import kz.korkem.invoice.service.ReconciliationService;
import org.springframework.format.annotation.DateTimeFormat;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

/** What clients bought and owe. */
@RestController
@RequestMapping("/api/clients")
@RequiredArgsConstructor
public class ClientActivityController {

    private final ClientActivityService activity;
    private final ReconciliationService reconciliation;

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

    /** Reconciliation statement (акт сверки) for [from, to]; by default from the 1st of January to today. */
    @GetMapping("/{id}/reconciliation")
    public Reconciliation reconciliation(@PathVariable Long id,
                                         @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                         @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return reconciliation.of(id, from, to);
    }

    /** 404 when the client has no invoices yet. */
    @GetMapping("/{id}/last-invoice")
    public InvoiceDto lastInvoice(@PathVariable Long id) {
        return activity.lastInvoice(id);
    }
}
