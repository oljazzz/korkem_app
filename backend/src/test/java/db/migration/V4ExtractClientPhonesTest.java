package db.migration;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import org.junit.jupiter.api.Test;

class V4ExtractClientPhonesTest {

    @Test
    void findsAndNormalisesKazakhMobileNumbers() {
        assertEquals("+7 707 638 51 36", V4__ExtractClientPhones.extract("ип. Шерхан 10 ряд 12 конт 8 707 638 51 36"));
        assertEquals("+7 702 257 20 73", V4__ExtractClientPhones.extract("ип.Алдияр Капчагай рынок Алга 87022572073"));
        assertEquals("+7 701 315 07 35", V4__ExtractClientPhones.extract("МАГ.БАКДАУЛЕТ 701 315 07 35 - ЕНБЕКШИ АРАЛ"));
        assertEquals("+7 701 111 22 33, +7 777 444 55 66",
                V4__ExtractClientPhones.extract("+7 (701) 111-22-33, 8 777 444 55 66, 87011112233"));
    }

    @Test
    void ignoresTextWithoutPhones() {
        assertNull(V4__ExtractClientPhones.extract("Узынагаш Еламан базар 10 ряд 12 конт"));
        assertNull(V4__ExtractClientPhones.extract("8 705 765 9 21"));
        assertNull(V4__ExtractClientPhones.extract(null));
    }
}
