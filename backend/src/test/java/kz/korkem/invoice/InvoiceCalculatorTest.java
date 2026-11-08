package kz.korkem.invoice;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.math.BigDecimal;
import kz.korkem.invoice.invoice.InvoiceCalculator;
import org.junit.jupiter.api.Test;

class InvoiceCalculatorTest {

    @Test
    void matchesOriginalSystem() {
        // Түпнұсқадан: 3 800 × 4 = 15 200, ҚҚС 1 628,57
        BigDecimal total = InvoiceCalculator.total(new BigDecimal("3800"), new BigDecimal("4"), null);
        assertEquals(new BigDecimal("15200.00"), total);
        assertEquals(new BigDecimal("1628.57"), InvoiceCalculator.vat(total));
        assertEquals(new BigDecimal("3348.21"), InvoiceCalculator.vat(new BigDecimal("31250")));
    }

    @Test
    void appliesDiscount() {
        assertEquals(new BigDecimal("900.00"),
                InvoiceCalculator.total(new BigDecimal("100"), new BigDecimal("10"), new BigDecimal("10")));
    }
}
