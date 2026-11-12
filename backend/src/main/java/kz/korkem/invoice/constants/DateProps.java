package kz.korkem.invoice.constants;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;

public class DateProps {
    public static final ZoneId ZONE = ZoneId.of("Asia/Almaty");

    /** Start of the day {@code from} in Almaty time; null when no lower bound. */
    public static Instant startOf(LocalDate from) {
        return from == null ? null : from.atStartOfDay(ZONE).toInstant();
    }

    /**
     * End of the day {@code to} (start of the next one) in Almaty time; null when no upper bound.
     */
    public static Instant endOf(LocalDate to) {
        return to == null ? null : to.plusDays(1).atStartOfDay(ZONE).toInstant();
    }
}
