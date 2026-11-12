package kz.korkem.invoice.util;

/**
 * What the user typed in the invoice search: digits only ("7 283" too) look up an invoice number,
 * anything else is matched against the client.
 */
public record InvoiceSearch(Long number, String text) {

    public static InvoiceSearch of(String q) {
        String query = q == null ? "" : q.trim();
        String digits = query.replaceAll("\\s", "");
        if (!digits.isEmpty() && digits.chars().allMatch(Character::isDigit) && digits.length() < 18) {
            return new InvoiceSearch(Long.parseLong(digits), "");
        }
        return new InvoiceSearch(null, query);
    }
}
