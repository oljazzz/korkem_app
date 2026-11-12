package kz.korkem.invoice.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.util.List;
import org.junit.jupiter.api.Test;

class PhonesTest {

    @Test
    void sameNumberInAnyFormatHasOneKey() {
        assertEquals("7011234567", Phones.key("8 701 123 45 67"));
        assertEquals("7011234567", Phones.key("+7 (701) 123-45-67"));
        assertEquals(List.of("8 701 1234567", "87772223344"), Phones.split(" 8 701 1234567 , ,87772223344"));
    }

    @Test
    void joinKeepsEachNumberOnce() {
        assertEquals("8 701 1234567, 87772223344", Phones.join("8 701 1234567", "+7 701 123 45 67, 87772223344"));
        assertNull(Phones.join(null, " "));
        assertEquals("87011234567", Phones.join("87011234567", "8".repeat(120)));
    }
}
