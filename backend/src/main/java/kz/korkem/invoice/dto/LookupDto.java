package kz.korkem.invoice.dto;

/** One choice of a fixed list (unit, payment method): the enum name and its Kazakh label. */
public record LookupDto(String value, String label) {}
