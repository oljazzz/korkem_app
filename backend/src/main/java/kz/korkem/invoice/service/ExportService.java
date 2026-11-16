package kz.korkem.invoice.service;

import static kz.korkem.invoice.constants.DateProps.ZONE;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.function.IntFunction;
import kz.korkem.invoice.dto.InvoiceDtos.InvoiceListItem;
import kz.korkem.invoice.dto.PageResponse;
import kz.korkem.invoice.dto.ProductDtos.ProductDto;
import kz.korkem.invoice.dto.ProductDtos.VariantDto;
import kz.korkem.invoice.dto.ReconciliationDtos.Entry;
import kz.korkem.invoice.dto.ReconciliationDtos.EntryKind;
import kz.korkem.invoice.dto.ReportDtos.SalesFilter;
import kz.korkem.invoice.util.XlsxTable;
import kz.korkem.invoice.util.XlsxTable.Column;
import kz.korkem.invoice.util.XlsxTable.Kind;
import kz.korkem.invoice.exception.BadRequestException;
import kz.korkem.invoice.properties.Messages;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The lists and reports as Excel files, built from the same services the screens use, so a file always
 * shows what the screen shows. Column titles and labels come from messages.properties (export.*).
 */
@Service
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class ExportService {

    /** A file is built in memory: more rows than this is refused (narrow the filter instead). */
    static final int MAX_ROWS = 20_000;

    /** A file to download: the suggested name (without extension) and the .xlsx bytes. */
    public record File(String name, byte[] content) {}

    private final InvoiceService invoices;
    private final ClientActivityService activity;
    private final ProductService products;
    private final SalesReportService sales;
    private final ReconciliationService reconciliation;
    private final SettingsService settings;
    private final Messages messages;
    private final Clock clock;

    /** The invoice list with the screen's filters, newest first. */
    public File invoices(String q, Long clientId, LocalDate from, LocalDate to, boolean dueOnly) {
        List<InvoiceListItem> items = all(page -> invoices.list(q, clientId, from, to, dueOnly, page, PageResponse.MAX_SIZE));
        XlsxTable t = new XlsxTable(m("export.invoices.sheet"), m("export.invoices.title"), List.of(
                new Column(m("export.col.number"), Kind.ID, 10),
                new Column(m("export.col.date"), Kind.DATE, 12),
                new Column(m("export.col.client"), Kind.TEXT, 36),
                new Column(m("export.col.place"), Kind.TEXT, 24),
                new Column(m("export.col.total"), Kind.MONEY, 14),
                new Column(m("export.col.paid"), Kind.MONEY, 14),
                new Column(m("export.col.due"), Kind.MONEY, 14),
                new Column(m("export.col.status"), Kind.TEXT, 14)))
                .subtitle(subtitle(period(from, to), dueOnly ? m("export.invoices.dueOnly") : null));
        BigDecimal total = BigDecimal.ZERO, paid = BigDecimal.ZERO, due = BigDecimal.ZERO;
        for (InvoiceListItem i : items) {
            t.row(i.number(), day(i.createdAt()), i.clientName(), i.clientPlace(), i.total(), i.paid(), i.due(),
                    messages.label("export.status", i.status()));
            total = total.add(i.total());
            paid = paid.add(i.paid());
            due = due.add(i.due());
        }
        t.totals(null, null, m("export.total", items.size()), null, total, paid, due, null);
        return new File(m("export.invoices.file", today()), t.toBytes());
    }

    /** Every client that owes money, largest debt first. */
    public File debtors() {
        var debts = activity.allDebtors();
        XlsxTable t = new XlsxTable(m("export.debtors.sheet"), m("export.debtors.title"), List.of(
                new Column(m("export.col.client"), Kind.TEXT, 36),
                new Column(m("export.col.phone"), Kind.TEXT, 22),
                new Column(m("export.col.city"), Kind.TEXT, 18),
                new Column(m("export.col.address"), Kind.TEXT, 30),
                new Column(m("export.col.openingDebt"), Kind.MONEY, 16),
                new Column(m("export.col.debt"), Kind.MONEY, 16)))
                .subtitle(subtitle(m("export.asOf", show(today())), null));
        debts.debtors().forEach(d -> t.row(d.client().name(), d.client().phone(), d.client().city(),
                d.client().address(), nonZero(d.client().openingDebt()), d.debt()));
        t.totals(m("export.total", debts.debtors().size()), null, null, null, null, debts.total());
        return new File(m("export.debtors.file", today()), t.toBytes());
    }

    /** The price list: one row per product, or per active colour of a product with colours. */
    public File prices(String q, Long categoryId) {
        List<ProductDto> items = all(page -> products.search(q, categoryId, page, PageResponse.MAX_SIZE));
        XlsxTable t = new XlsxTable(m("export.prices.sheet"), m("export.prices.title"), List.of(
                new Column(m("export.col.category"), Kind.TEXT, 22),
                new Column(m("export.col.product"), Kind.TEXT, 40),
                new Column(m("export.col.colour"), Kind.TEXT, 18),
                new Column(m("export.col.pack"), Kind.TEXT, 10),
                new Column(m("export.col.price"), Kind.MONEY, 14)))
                .subtitle(subtitle(m("export.asOf", show(today())), settings.get().company().name()));
        for (ProductDto p : items) {
            String pack = p.packAmount() == null ? null
                    : p.packAmount().stripTrailingZeros().toPlainString() + " " + messages.label("unit", p.packUnit());
            List<VariantDto> colours = p.variants() == null ? List.of() : p.variants().stream().filter(VariantDto::active).toList();
            if (colours.isEmpty()) {
                t.row(p.categoryName(), p.name(), null, pack, p.price());
            } else {
                colours.forEach(v -> t.row(p.categoryName(), p.name(), v.name(), pack, v.price() != null ? v.price() : p.price()));
            }
        }
        return new File(m("export.prices.file", today()), t.toBytes());
    }

    /** The "sold products" report with the screen's filters. */
    public File sales(SalesFilter filter) {
        var report = sales.report(filter);
        XlsxTable t = new XlsxTable(m("export.sales.sheet"), m("export.sales.title"), List.of(
                new Column(m("export.col.product"), Kind.TEXT, 40),
                new Column(m("export.col.category"), Kind.TEXT, 22),
                new Column(m("export.col.quantity"), Kind.NUMBER, 10),
                new Column(m("export.col.avgPrice"), Kind.MONEY, 14),
                new Column(m("export.col.total"), Kind.MONEY, 16),
                new Column(m("export.col.vat"), Kind.MONEY, 14),
                new Column(m("export.col.invoices"), Kind.INT, 12)))
                .subtitle(subtitle(filter.invoiceIds() != null && !filter.invoiceIds().isEmpty()
                        ? m("export.sales.selection", report.invoiceCount())
                        : period(report.from(), report.to()), null));
        report.rows().forEach(r -> t.row(r.productName(), r.categoryName(), r.quantity(), r.avgPrice(), r.total(), r.vat(), r.invoices()));
        t.totals(m("export.total", report.rows().size()), null, report.totalQuantity(), null, report.total(), report.vat(),
                report.invoiceCount());
        return new File(m("export.sales.file", report.from() == null ? today() : report.from(),
                report.to() == null ? today() : report.to()), t.toBytes());
    }

    /** The reconciliation statement's figures (the signed paper is the printed page). */
    public File reconciliation(Long clientId, LocalDate from, LocalDate to) {
        var act = reconciliation.of(clientId, from, to);
        XlsxTable t = new XlsxTable(m("export.act.sheet"), m("export.act.title"), List.of(
                new Column(m("export.col.date"), Kind.DATE, 12),
                new Column(m("export.col.document"), Kind.TEXT, 48),
                new Column(m("export.col.debit"), Kind.MONEY, 16),
                new Column(m("export.col.credit"), Kind.MONEY, 16)))
                .subtitle(subtitle(act.client().name(), period(act.from(), act.to())));
        t.row(act.from(), m("export.act.opening"), act.opening().signum() >= 0 ? act.opening() : null,
                act.opening().signum() < 0 ? act.opening().negate() : null);
        for (Entry e : act.entries()) {
            t.row(e.date(), document(e), nonZero(e.debit()), nonZero(e.credit()));
        }
        t.row(null, m("export.act.turnover"), act.debit(), act.credit());
        t.totals(act.to(), m("export.act.closing"), act.closing().signum() >= 0 ? act.closing() : null,
                act.closing().signum() < 0 ? act.closing().negate() : null);
        return new File(m("export.act.file", act.client().name(), act.from(), act.to()), t.toBytes());
    }

    private String document(Entry e) {
        if (e.kind() == EntryKind.PAYMENT) {
            return m("export.act.payment", String.valueOf(e.invoiceNumber()), e.method() == null ? "" : messages.label("paymentMethod", e.method()));
        }
        return m(e.legacyPaid() ? "export.act.legacyInvoice" : "export.act.invoice", String.valueOf(e.invoiceNumber()));
    }

    /** Every page of a paged list, refusing more than MAX_ROWS. */
    private static <T> List<T> all(IntFunction<PageResponse<T>> page) {
        List<T> result = new ArrayList<>();
        for (int p = 0; ; p++) {
            PageResponse<T> chunk = page.apply(p);
            result.addAll(chunk.items());
            if (result.size() > MAX_ROWS) throw new BadRequestException("error.export.tooMany", MAX_ROWS);
            if (chunk.items().size() < chunk.size() || result.size() >= chunk.total()) return result;
        }
    }

    private String period(LocalDate from, LocalDate to) {
        if (from == null && to == null) return m("export.period.all");
        return m("export.period", from == null ? "…" : show(from), to == null ? "…" : show(to));
    }

    private static final java.time.format.DateTimeFormatter DAY = java.time.format.DateTimeFormatter.ofPattern("dd.MM.yyyy");

    private static String show(LocalDate d) {
        return DAY.format(d);
    }

    private static String subtitle(String a, String b) {
        return b == null ? a : a + " · " + b;
    }

    private LocalDate today() {
        return LocalDate.now(clock.withZone(ZONE));
    }

    private static LocalDate day(Instant at) {
        return at == null ? null : at.atZone(ZONE).toLocalDate();
    }

    private static BigDecimal nonZero(BigDecimal v) {
        return v == null || v.signum() == 0 ? null : v;
    }

    private String m(String key, Object... args) {
        return messages.get(key, args);
    }
}
