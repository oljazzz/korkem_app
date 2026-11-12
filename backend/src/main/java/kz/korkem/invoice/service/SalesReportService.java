package kz.korkem.invoice.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Objects;
import java.util.function.Function;
import kz.korkem.invoice.dto.ReportDtos.SalesFilter;
import kz.korkem.invoice.dto.ReportDtos.SalesReport;
import kz.korkem.invoice.dto.ReportDtos.SalesRow;
import kz.korkem.invoice.exception.BadRequestException;
import kz.korkem.invoice.repository.query.SalesReportQuery;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** "Sold products" report: total quantity and amount per product over the invoices a filter selects. */
@Service
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class SalesReportService {

    /** Upper bound for an explicit invoice selection. */
    private static final int MAX_INVOICE_IDS = 1000;

    private final SalesReportQuery query;

    public SalesReport report(SalesFilter f) {
        if (f.invoiceIds() != null && f.invoiceIds().size() > MAX_INVOICE_IDS) {
            throw new BadRequestException("error.report.tooManyInvoices", String.valueOf(MAX_INVOICE_IDS));
        }
        List<SalesRow> rows = query.rows(f).stream().map(SalesReportService::toRow).toList();
        return new SalesReport(f.from(), f.to(), query.invoiceCount(f), rows,
                sum(rows, SalesRow::quantity), sum(rows, SalesRow::total), sum(rows, SalesRow::vat));
    }

    /** Products without colours are their own group; the price is the average over the period. */
    private static SalesRow toRow(SalesReportQuery.Row r) {
        BigDecimal avgPrice = r.quantity().signum() == 0
                ? BigDecimal.ZERO : r.total().divide(r.quantity(), 2, RoundingMode.HALF_UP);
        return new SalesRow(r.productName(), r.groupName() == null ? r.productName() : r.groupName(),
                r.categoryName(), r.quantity(), avgPrice, r.total(), r.vat(), r.invoices());
    }

    private static <T> BigDecimal sum(List<T> rows, Function<T, BigDecimal> f) {
        return rows.stream().map(f).filter(Objects::nonNull).reduce(BigDecimal.ZERO, BigDecimal::add);
    }
}
