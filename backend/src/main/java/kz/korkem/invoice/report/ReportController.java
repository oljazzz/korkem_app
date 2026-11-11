package kz.korkem.invoice.report;

import java.time.LocalDate;
import java.util.List;
import kz.korkem.invoice.common.BadRequestException;
import kz.korkem.invoice.report.ReportDtos.Dashboard;
import kz.korkem.invoice.report.ReportDtos.SalesReport;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.format.annotation.DateTimeFormat.ISO;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Report endpoints: checks the request and hands it to the report services. */
@RestController
@RequestMapping("/api/reports")
@RequiredArgsConstructor
public class ReportController {

    /** Upper bound for an explicit invoice selection in the sales report. */
    private static final int MAX_INVOICE_IDS = 1000;

    private final SalesReportService sales;
    private final DashboardService dashboards;

    /**
     * "Sold products" report: total quantity and amount per product.
     * Filter by period, client, town or an explicit list of invoices (same as the legacy report).
     */
    @GetMapping("/sales")
    public SalesReport sales(@RequestParam(required = false) @DateTimeFormat(iso = ISO.DATE) LocalDate from,
                             @RequestParam(required = false) @DateTimeFormat(iso = ISO.DATE) LocalDate to,
                             @RequestParam(required = false) Long clientId,
                             @RequestParam(required = false) String city,
                             @RequestParam(required = false) List<Long> invoiceIds) {
        if (invoiceIds != null && invoiceIds.size() > MAX_INVOICE_IDS) {
            throw new BadRequestException("error.report.tooManyInvoices", String.valueOf(MAX_INVOICE_IDS));
        }
        return sales.report(new SalesReportService.Filter(from, to, clientId, city, invoiceIds));
    }

    /** Dashboard figures: revenue for a period, comparison with the previous period, trend and top lists. */
    @GetMapping("/dashboard")
    public Dashboard dashboard(@RequestParam @DateTimeFormat(iso = ISO.DATE) LocalDate from,
                               @RequestParam @DateTimeFormat(iso = ISO.DATE) LocalDate to) {
        if (to.isBefore(from)) throw new BadRequestException("error.report.badPeriod");
        return dashboards.dashboard(from, to);
    }
}
