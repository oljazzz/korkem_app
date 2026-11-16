package kz.korkem.invoice.util;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.math.BigDecimal;
import org.junit.jupiter.api.Test;

class MoneyTest {

    @Test
    void writesAmountsLikeTheApp() {
        assertEquals("273 300", Money.format(new BigDecimal("273300.00")));
        assertEquals("1 234,50", Money.format(new BigDecimal("1234.5")));
        assertEquals("999", Money.format(new BigDecimal("999")));
        assertEquals("0", Money.format(BigDecimal.ZERO));
        assertEquals("1 000 000", Money.format(new BigDecimal("1000000")));
        assertEquals("−5 000", Money.format(new BigDecimal("-5000.00")));
    }
}
