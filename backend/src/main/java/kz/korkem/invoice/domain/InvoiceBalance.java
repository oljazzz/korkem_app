package kz.korkem.invoice.domain;

import java.math.BigDecimal;
import kz.korkem.invoice.entities.Invoice;
import kz.korkem.invoice.enums.PaymentStatus;

/**
 * What an invoice is worth and how much of it is paid. The one place for the payment rules:
 * invoices from before payments were tracked ({@code legacyPaid}) count as fully paid.
 */
public record InvoiceBalance(BigDecimal total, BigDecimal paid, boolean legacyPaid) {

    public static InvoiceBalance of(Invoice invoice, BigDecimal paid) {
        return new InvoiceBalance(invoice.total(), paid, invoice.isLegacyPaid());
    }

    /** What is still owed; never negative. */
    public BigDecimal due() {
        return legacyPaid ? BigDecimal.ZERO : total.subtract(paid).max(BigDecimal.ZERO);
    }

    public PaymentStatus status() {
        if (legacyPaid || paid.compareTo(total) >= 0) return PaymentStatus.PAID;
        return paid.signum() > 0 ? PaymentStatus.PARTIAL : PaymentStatus.UNPAID;
    }

    /** False when lines were cut below what has already been paid. */
    public boolean coversPaid() {
        return total.compareTo(paid) >= 0;
    }

    /** False when the amount is more than is still owed (or the invoice takes no payments). */
    public boolean accepts(BigDecimal amount) {
        return !legacyPaid && amount.compareTo(due()) <= 0;
    }
}
