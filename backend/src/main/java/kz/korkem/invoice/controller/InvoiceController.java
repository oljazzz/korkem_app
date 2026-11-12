package kz.korkem.invoice.controller;

import jakarta.validation.Valid;
import java.security.Principal;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.List;
import kz.korkem.invoice.properties.Messages;
import kz.korkem.invoice.dto.PageResponse;
import kz.korkem.invoice.dto.InvoiceDtos.*;
import kz.korkem.invoice.service.InvoiceService;
import kz.korkem.invoice.enums.Unit;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/invoices")
@RequiredArgsConstructor
public class InvoiceController {

    public record UnitDto(Unit value, String label) {}

    private final InvoiceService service;
    private final Messages messages;

    @GetMapping
    public PageResponse<InvoiceListItem> list(@RequestParam(defaultValue = "") String q,
                                              @RequestParam(required = false) Long clientId,
                                              @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                              @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
                                              @RequestParam(defaultValue = "false") boolean dueOnly,
                                              @RequestParam(defaultValue = "0") int page,
                                              @RequestParam(defaultValue = "50") int size) {
        return service.list(q, clientId, from, to, dueOnly, page, size);
    }

    /** Totals for the same filters as the list: count, amount, amount still owed. */
    @GetMapping("/summary")
    public InvoiceSummary summary(@RequestParam(defaultValue = "") String q,
                                  @RequestParam(required = false) Long clientId,
                                  @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                  @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
                                  @RequestParam(defaultValue = "false") boolean dueOnly) {
        return service.summary(q, clientId, from, to, dueOnly);
    }

    @GetMapping("/units")
    public List<UnitDto> units() {
        return Arrays.stream(Unit.values()).map(u -> new UnitDto(u, messages.label("unit", u))).toList();
    }

    @GetMapping("/{id}")
    public InvoiceDto get(@PathVariable Long id) {
        return service.get(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public InvoiceDto create(@Valid @RequestBody InvoiceRequest req, Principal principal) {
        return service.create(req, principal == null ? null : principal.getName());
    }

    @PutMapping("/{id}")
    public InvoiceDto update(@PathVariable Long id, @Valid @RequestBody InvoiceRequest req) {
        return service.update(id, req);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        service.delete(id);
    }
}
