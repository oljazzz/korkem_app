package kz.korkem.invoice.util;

import java.util.regex.Pattern;

/** Display helpers for legacy client data, where phone numbers were typed into the name and address. */
public final class ClientText {
    private ClientText() {}

    // Same shape as migration V4: optional +7/8, a 7XX operator code, then 7 digits with separators
    private static final Pattern PHONE = Pattern.compile(
            "(?<!\\d)(?:\\+?7|8)?[\\s-]*\\(?7\\d{2}\\)?[\\s-]*\\d{3}[\\s-]*\\d{2}[\\s-]*\\d{2}(?!\\d)");
    private static final Pattern PHONE_WORD = Pattern.compile("(?iU)\\b(тел|tel)\\.?\\s*[-:]?\\s*$");

    /** Text without phone numbers (they live in the phone field), with leftover separators tidied. */
    public static String withoutPhones(String text) {
        if (text == null) return null;
        String s = PHONE.matcher(text).replaceAll(" ");
        s = PHONE_WORD.matcher(s.strip()).replaceAll("");
        s = s.replaceAll("\\s+", " ").replaceAll("(\\s*[-,·]\\s*)+$", "").replaceAll("^\\s*[-,·]\\s*", "").strip();
        return s.isEmpty() ? null : s;
    }
}
