package kz.korkem.invoice.service;

import java.math.BigDecimal;
import java.math.RoundingMode;

import kz.korkem.invoice.properties.VatProperties;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * Line total and VAT.
 * total = price × quantity × (1 − discount/100)
 * VAT is included in the price: vat = total × rate / (100 + rate), same as the legacy system.
 */
@Component
@RequiredArgsConstructor
public class InvoiceCalculator {
    private static final BigDecimal HUNDRED = new BigDecimal("100");

    private final VatProperties vat;

    public BigDecimal total(BigDecimal price, BigDecimal quantity, BigDecimal discount) {
        BigDecimal gross = price.multiply(quantity);
        if (discount != null && discount.signum() > 0) {
            gross = gross.multiply(HUNDRED.subtract(discount)).divide(HUNDRED, 6, RoundingMode.HALF_UP);
        }
        return gross.setScale(2, RoundingMode.HALF_UP);
    }

    public BigDecimal vat(BigDecimal total) {
        return total.multiply(vat.rate()).divide(HUNDRED.add(vat.rate()), 2, RoundingMode.HALF_UP);
    }
}
