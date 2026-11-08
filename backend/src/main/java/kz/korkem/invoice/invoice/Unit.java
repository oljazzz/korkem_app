package kz.korkem.invoice.invoice;

/** Өлшем бірлігі. Түпнұсқа жүйеде тек "Шт" бар; қажет болса осында қосыңыз. */
public enum Unit {
    SHT("Шт"),
    KG("Кг"),
    M("М"),
    L("Л"),
    PACK("Упак");

    private final String label;

    Unit(String label) {
        this.label = label;
    }

    public String getLabel() {
        return label;
    }
}
