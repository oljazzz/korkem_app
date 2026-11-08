package kz.korkem.invoice.invoice;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * Жол сомасын және ҚҚС-ты есептеу.
 * Сомма = Баға × Саны × (1 − Жеңілдік/100).
 * ҚҚС бағаның ішінде (12%): ҚҚС = Сомма × 12 / 112 — түпнұсқа жүйедегідей.
 */
public final class InvoiceCalculator {
    public static final BigDecimal VAT_RATE = new BigDecimal("12");
    private static final BigDecimal HUNDRED = new BigDecimal("100");

    private InvoiceCalculator() {}

    public static BigDecimal total(BigDecimal price, BigDecimal quantity, BigDecimal discount) {
        BigDecimal gross = price.multiply(quantity);
        if (discount != null && discount.signum() > 0) {
            gross = gross.multiply(HUNDRED.subtract(discount)).divide(HUNDRED, 6, RoundingMode.HALF_UP);
        }
        return gross.setScale(2, RoundingMode.HALF_UP);
    }

    public static BigDecimal vat(BigDecimal total) {
        return total.multiply(VAT_RATE).divide(HUNDRED.add(VAT_RATE), 2, RoundingMode.HALF_UP);
    }
}
