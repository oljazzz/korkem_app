package db.migration;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.math.BigDecimal;
import org.junit.jupiter.api.Test;

class V8ExtractProductPacksTest {

    private static V8__ExtractProductPacks.Pack pack(String amount, String unit) {
        return new V8__ExtractProductPacks.Pack(new BigDecimal(amount).setScale(3), unit);
    }

    @Test
    void readsMassAndVolume() {
        assertEquals(pack("20", "KG"), V8__ExtractProductPacks.packFrom("IRIS COLOR СЕРЫЙ 20кг"));
        assertEquals(pack("2.7", "KG"), V8__ExtractProductPacks.packFrom("Грунт-эмаль УЗОР СЕРАЯ 2,7кг"));
        assertEquals(pack("0.8", "KG"), V8__ExtractProductPacks.packFrom("КЛЕЙ ПВА 800гр"));
        assertEquals(pack("5", "L"), V8__ExtractProductPacks.packFrom("ЖИДКОЕ МЫЛО 5Л"));
        assertEquals(pack("0.5", "L"), V8__ExtractProductPacks.packFrom("Растворитель 646 500мл"));
        assertEquals(pack("3.7", "L"), V8__ExtractProductPacks.packFrom("646 POLIMAX 3.7л"));
    }

    @Test
    void skipsAmbiguousAndSizelessNames() {
        assertNull(V8__ExtractProductPacks.packFrom("КЛЕЙ STERN 200мл + 50гр"));
        assertNull(V8__ExtractProductPacks.packFrom("ПЕНА монтажная 65л 870мл PROFPUR"));
        assertNull(V8__ExtractProductPacks.packFrom("АЭРОЗОЛЬ 3004 БОРДОВЫЙ"));
        assertNull(V8__ExtractProductPacks.packFrom("КИСТЬ 50 ГРАФИТ"));
        assertNull(V8__ExtractProductPacks.packFrom("ЛЕНТА 50 МЕТРОВ"));
        assertNull(V8__ExtractProductPacks.packFrom(null));
    }
}
