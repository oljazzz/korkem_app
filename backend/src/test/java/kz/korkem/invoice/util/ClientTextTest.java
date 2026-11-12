package kz.korkem.invoice.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import org.junit.jupiter.api.Test;

class ClientTextTest {

    @Test
    void removesPhoneNumbersAndLeftoverSeparators() {
        assertEquals("БАТЫР", ClientText.withoutPhones("БАТЫР 8 707 652 65 16"));
        assertEquals("Капчагай Алга рынок", ClientText.withoutPhones("Капчагай Алга рынок 87476740474"));
        assertEquals("МАГ.БАКДАУЛЕТ", ClientText.withoutPhones("МАГ.БАКДАУЛЕТ 701 315 07 35"));
        assertEquals("КОНАЕВ СЕЙФУЛЛИНА 15/6", ClientText.withoutPhones("КОНАЕВ СЕЙФУЛЛИНА 15/6 тел - 708 974 07 07"));
        assertEquals("Талгар 1 ряд 14 контр", ClientText.withoutPhones("Талгар 1 ряд 14 контр"));
        assertNull(ClientText.withoutPhones("8 701 154 57 73"));
        assertNull(ClientText.withoutPhones(null));
    }
}
