package kz.korkem.invoice.util;

import java.math.BigDecimal;
import java.math.RoundingMode;

/** Amounts in messages, written the way the app shows them: 273 300 or 1 234,50 (no ".00"). */
public final class Money {

    private Money() {}

    public static String format(BigDecimal amount) {
        if (amount == null) return "";
        BigDecimal v = amount.setScale(2, RoundingMode.HALF_UP);
        boolean whole = v.stripTrailingZeros().scale() <= 0;
        String digits = v.abs().setScale(whole ? 0 : 2, RoundingMode.HALF_UP).toPlainString();
        String[] parts = digits.split("\\.");
        StringBuilder grouped = new StringBuilder(parts[0]);
        for (int i = grouped.length() - 3; i > 0; i -= 3) grouped.insert(i, ' ');
        return (v.signum() < 0 ? "−" : "") + grouped + (parts.length > 1 ? "," + parts[1] : "");
    }
}
