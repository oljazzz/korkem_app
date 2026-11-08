package kz.korkem.invoice;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.math.BigDecimal;
import kz.korkem.invoice.invoice.InvoiceCalculator;
import kz.korkem.invoice.invoice.VatProperties;
import org.junit.jupiter.api.Test;

class InvoiceCalculatorTest {

    private final InvoiceCalculator calc = new InvoiceCalculator(new VatProperties(new BigDecimal("12")));

    @Test
    void matchesLegacySystem() {
        // From the legacy system: 3 800 × 4 = 15 200, VAT 1 628.57
        BigDecimal total = calc.total(new BigDecimal("3800"), new BigDecimal("4"), null);
        assertEquals(new BigDecimal("15200.00"), total);
        assertEquals(new BigDecimal("1628.57"), calc.vat(total));
        assertEquals(new BigDecimal("3348.21"), calc.vat(new BigDecimal("31250")));
    }

    @Test
    void appliesDiscount() {
        assertEquals(new BigDecimal("900.00"),
                calc.total(new BigDecimal("100"), new BigDecimal("10"), new BigDecimal("10")));
    }

    @Test
    void usesConfiguredRate() {
        InvoiceCalculator calc16 = new InvoiceCalculator(new VatProperties(new BigDecimal("16")));
        assertEquals(new BigDecimal("16.00"), calc16.vat(new BigDecimal("116")));
    }
}
