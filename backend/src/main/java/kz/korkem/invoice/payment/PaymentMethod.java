package kz.korkem.invoice.payment;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

@Getter
@RequiredArgsConstructor
public enum PaymentMethod {
    CASH("Қолма-қол"),
    CARD("Карта"),
    TRANSFER("Аударым");

    /** Label shown in the UI. */
    private final String label;
}
