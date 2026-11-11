package kz.korkem.invoice.report;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

/** Response bodies of the report endpoints. */
public final class ReportDtos {

    private ReportDtos() {}

    /** {@code groupName} is the product a colour belongs to (equals productName for products without colours). */
    public record SalesRow(String productName, String groupName, String categoryName, BigDecimal quantity,
                           BigDecimal avgPrice, BigDecimal total, BigDecimal vat, long invoices) {}

    public record SalesReport(LocalDate from, LocalDate to, int invoiceCount, List<SalesRow> rows,
                              BigDecimal totalQuantity, BigDecimal total, BigDecimal vat) {}

    public record Kpi(BigDecimal revenue, long invoices, BigDecimal avgCheck, BigDecimal vat, long clients) {}

    public record Point(String label, LocalDate start, BigDecimal revenue, long invoices) {}

    /** {@code id} is the client id in the top-clients list, null elsewhere. */
    public record Ranked(Long id, String name, BigDecimal revenue, BigDecimal quantity, long invoices) {}

    /** {@code granularity} is "day" or "month": how {@code series} is bucketed. */
    public record Dashboard(LocalDate from, LocalDate to, String granularity, Kpi current, Kpi previous,
                            List<Point> series, List<Ranked> topProducts, List<Ranked> topClients,
                            List<Ranked> categories, Instant lastInvoiceAt) {}
}
