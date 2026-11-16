package kz.korkem.invoice.mapper;

import java.math.BigDecimal;
import java.time.LocalDate;
import kz.korkem.invoice.constants.DateProps;
import kz.korkem.invoice.domain.InvoiceBalance;
import kz.korkem.invoice.dto.InvoiceDtos.InvoiceDto;
import kz.korkem.invoice.dto.InvoiceDtos.InvoiceListItem;
import kz.korkem.invoice.dto.InvoiceDtos.LineDto;
import kz.korkem.invoice.entities.Invoice;
import kz.korkem.invoice.entities.InvoiceLine;
import kz.korkem.invoice.properties.Messages;
import kz.korkem.invoice.util.Snapshot;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class InvoiceMapper {

    private final Messages messages;

    /** {@code invoice} with its lines loaded; {@code paid} is the sum of its payments. */
    public InvoiceDto toDto(Invoice invoice, BigDecimal paid) {
        InvoiceBalance balance = InvoiceBalance.of(invoice, paid);
        var c = invoice.getClient();
        return new InvoiceDto(invoice.getId(), invoice.getNumber(), c == null ? null : c.getId(),
                c == null ? null : c.getDisplayName(), c == null ? null : c.getLabel(),
                invoice.getCreatedAt(), invoice.getCreatedBy(),
                invoice.getLines().stream().map(this::toDto).toList(), balance.total(), invoice.vat(),
                paid, balance.due(), balance.status(), invoice.isLegacyPaid());
    }

    /** List row: totals come from aggregate queries, so the lines need not be loaded. */
    public InvoiceListItem toListItem(Invoice invoice, InvoiceBalance balance) {
        var c = invoice.getClient();
        return new InvoiceListItem(invoice.getId(), invoice.getNumber(), c == null ? null : c.getId(),
                c == null ? null : c.getLabel(), c == null ? null : c.getPlace(), invoice.getCreatedAt(),
                balance.total(), balance.paid(), balance.due(), balance.status());
    }

    private LineDto toDto(InvoiceLine l) {
        var category = l.getCategory();
        var product = l.getProduct();
        return new LineDto(l.getId(),
                category == null ? null : category.getId(), category == null ? null : category.getName(),
                product == null ? null : product.getId(), l.getVariant() == null ? null : l.getVariant().getId(),
                l.getProductName(), l.getUnit(), messages.label("unit", l.getUnit()), l.getPrice(), l.getQuantity(),
                l.getDiscount(), l.getTotal(), l.getVat(), l.getSortOrder(),
                product == null ? null : product.getPackAmount(), product == null ? null : product.getPackUnit());
    }

    /** State for the audit log: who it is for, its date, every line and the total. */
    public Snapshot audit(Invoice invoice) {
        var c = invoice.getClient();
        return Snapshot.of()
                .put("number", invoice.getNumber())
                .put("client", c == null ? null : c.getLabel())
                .put("date", invoice.getCreatedAt() == null ? null : LocalDate.ofInstant(invoice.getCreatedAt(), DateProps.ZONE))
                .put("lines", invoice.getLines().stream().map(this::auditLine).toList())
                .put("total", invoice.total());
    }

    /** "Статус ПФ-115 ақ — 2 шт × 2700 −5% = 5130" */
    private String auditLine(InvoiceLine l) {
        String discount = l.getDiscount() == null || l.getDiscount().signum() == 0 ? "" : " −" + plain(l.getDiscount()) + "%";
        return l.getProductName() + " — " + plain(l.getQuantity()) + " " + messages.label("unit", l.getUnit())
                + " × " + plain(l.getPrice()) + discount + " = " + plain(l.getTotal());
    }

    private static String plain(BigDecimal v) {
        return v == null ? "" : v.stripTrailingZeros().toPlainString();
    }
}
