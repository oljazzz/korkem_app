package kz.korkem.invoice.util;

import java.math.BigDecimal;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * A record's state for the audit log: readable field values in a fixed order. Empty values are left
 * out and numbers lose trailing zeros, so 2700 and 2700.00 do not show up as a change.
 */
public final class Snapshot {

    private final Map<String, Object> fields = new LinkedHashMap<>();

    public static Snapshot of() {
        return new Snapshot();
    }

    public Snapshot put(String field, Object value) {
        Object v = value instanceof BigDecimal d ? d.stripTrailingZeros() : value;
        if (v instanceof BigDecimal d && d.scale() < 0) v = d.setScale(0);
        boolean empty = v == null || (v instanceof String s && s.isBlank()) || (v instanceof Collection<?> c && c.isEmpty());
        if (!empty) fields.put(field, v instanceof Enum<?> e ? e.name() : v);
        return this;
    }

    public Map<String, Object> fields() {
        return fields;
    }
}
