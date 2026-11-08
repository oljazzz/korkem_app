package kz.korkem.invoice.invoice;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

/** Unit of measure. The legacy system only had "pieces"; add more here when needed. */
@Getter
@RequiredArgsConstructor
public enum Unit {
    SHT("дана"),
    KG("кг"),
    M("м"),
    L("л"),
    PACK("орам");

    /** Label shown in the UI and on printed documents. */
    private final String label;
}
