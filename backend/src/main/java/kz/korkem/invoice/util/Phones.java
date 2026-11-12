package kz.korkem.invoice.util;

import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** A client's phone field: one or more numbers separated by commas, written in any format. */
public final class Phones {

    /** The phone column's length. */
    private static final int MAX_LENGTH = 100;

    private Phones() {}

    public static List<String> split(String value) {
        if (value == null) return List.of();
        return Arrays.stream(value.split(",")).map(String::trim).filter(p -> !p.isEmpty()).toList();
    }

    /** Digits only, without the 8/7 country prefix, so "8 701 …" and "+7 (701) …" compare equal. */
    public static String key(String phone) {
        String d = phone.replaceAll("\\D", "");
        return d.length() == 11 && (d.startsWith("8") || d.startsWith("7")) ? d.substring(1) : d;
    }

    /** Union of both lists, each number once; {@code first} alone if the union would not fit the column. */
    public static String join(String first, String second) {
        Map<String, String> all = new LinkedHashMap<>();
        for (String p : split(first)) all.putIfAbsent(key(p), p);
        for (String p : split(second)) all.putIfAbsent(key(p), p);
        String joined = String.join(", ", all.values());
        if (joined.isEmpty()) return null;
        return joined.length() > MAX_LENGTH ? first : joined;
    }
}
