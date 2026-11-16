package kz.korkem.invoice.controller;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.List;
import kz.korkem.invoice.dto.ReportDtos.SalesFilter;
import kz.korkem.invoice.service.ExportService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.format.annotation.DateTimeFormat.ISO;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Excel downloads. Each takes the same filters as the screen it exports. */
@RestController
@RequestMapping("/api/export")
@RequiredArgsConstructor
public class ExportController {

    static final MediaType XLSX = MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

    private final ExportService export;

    @GetMapping("/invoices")
    public ResponseEntity<byte[]> invoices(@RequestParam(defaultValue = "") String q,
                                           @RequestParam(required = false) Long clientId,
                                           @RequestParam(required = false) @DateTimeFormat(iso = ISO.DATE) LocalDate from,
                                           @RequestParam(required = false) @DateTimeFormat(iso = ISO.DATE) LocalDate to,
                                           @RequestParam(defaultValue = "false") boolean dueOnly) {
        return file(export.invoices(q, clientId, from, to, dueOnly));
    }

    @GetMapping("/debtors")
    public ResponseEntity<byte[]> debtors() {
        return file(export.debtors());
    }

    @GetMapping("/prices")
    public ResponseEntity<byte[]> prices(@RequestParam(defaultValue = "") String q,
                                         @RequestParam(required = false) Long categoryId) {
        return file(export.prices(q, categoryId));
    }

    @GetMapping("/sales")
    public ResponseEntity<byte[]> sales(@RequestParam(required = false) @DateTimeFormat(iso = ISO.DATE) LocalDate from,
                                        @RequestParam(required = false) @DateTimeFormat(iso = ISO.DATE) LocalDate to,
                                        @RequestParam(required = false) Long clientId,
                                        @RequestParam(required = false) String city,
                                        @RequestParam(required = false) List<Long> invoiceIds) {
        return file(export.sales(new SalesFilter(from, to, clientId, city, invoiceIds)));
    }

    @GetMapping("/clients/{id}/reconciliation")
    public ResponseEntity<byte[]> reconciliation(@PathVariable Long id,
                                                 @RequestParam(required = false) @DateTimeFormat(iso = ISO.DATE) LocalDate from,
                                                 @RequestParam(required = false) @DateTimeFormat(iso = ISO.DATE) LocalDate to) {
        return file(export.reconciliation(id, from, to));
    }

    /** Downloaded, not shown; the name keeps Kazakh letters (RFC 5987) and is never cached. */
    private static ResponseEntity<byte[]> file(ExportService.File f) {
        String name = f.name().replaceAll("[\\\\/:*?\"<>|]", "_") + ".xlsx";
        return ResponseEntity.ok()
                .contentType(XLSX)
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename(name, StandardCharsets.UTF_8).build().toString())
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .body(f.content());
    }
}
