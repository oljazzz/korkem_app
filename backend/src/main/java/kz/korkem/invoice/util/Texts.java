package kz.korkem.invoice.util;

/** Small text helpers for request values. */
public final class Texts {

    private Texts() {}

    /** Trimmed text, or null when blank: optional fields are stored as null rather than "". */
    public static String clean(String v) {
        return v == null || v.isBlank() ? null : v.trim();
    }
}
