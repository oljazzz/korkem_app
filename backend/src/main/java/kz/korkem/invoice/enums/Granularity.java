package kz.korkem.invoice.enums;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.Locale;

/**
 * How the dashboard trend is bucketed: by day for up to two months, by month beyond that.
 */
public enum Granularity {
    DAY("dd.MM", ChronoUnit.DAYS) {
        @Override
        public LocalDate bucketOf(LocalDate day) {
            return day;
        }
    },
    MONTH("MM.yyyy", ChronoUnit.MONTHS) {
        @Override
        public LocalDate bucketOf(LocalDate day) {
            return day.withDayOfMonth(1);
        }
    };

    private static final int MAX_DAYS_BY_DAY = 62;

    private final DateTimeFormatter label;
    private final ChronoUnit step;

    Granularity(String pattern, ChronoUnit step) {
        this.label = DateTimeFormatter.ofPattern(pattern);
        this.step = step;
    }

    public static Granularity forDays(long days) {
        return days <= MAX_DAYS_BY_DAY ? DAY : MONTH;
    }

    /** The bucket a day falls into, given by its first day. */
    public abstract LocalDate bucketOf(LocalDate day);

    public LocalDate next(LocalDate bucket) {
        return bucket.plus(1, step);
    }

    public String label(LocalDate bucket) {
        return bucket.format(label);
    }

    /** Value sent to the frontend. */
    public String code() {
        return name().toLowerCase(Locale.ROOT);
    }
}
