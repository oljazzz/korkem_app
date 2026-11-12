package kz.korkem.invoice.enums;

import java.math.BigDecimal;

public enum PaymentStatus {
    PAID, PARTIAL, UNPAID;

    /** Invoices that existed before payments were tracked count as paid. */
    public static PaymentStatus of(BigDecimal total, BigDecimal paid, boolean legacyPaid) {
        if (legacyPaid || paid.compareTo(total) >= 0) return PAID;
        return paid.signum() > 0 ? PARTIAL : UNPAID;
    }

    /** What is still owed on an invoice. */
    public static BigDecimal due(BigDecimal total, BigDecimal paid, boolean legacyPaid) {
        return legacyPaid ? BigDecimal.ZERO : total.subtract(paid).max(BigDecimal.ZERO);
    }
}
