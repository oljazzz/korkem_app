package kz.korkem.invoice.enums;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Locale;

/**
 * How the dashboard trend is bucketed: by day for up to two months, by month beyond that.
 */
public enum Granularity {
    DAY("dd.MM"),
    MONTH("MM.yyyy");

    private static final int MAX_DAYS_BY_DAY = 62;

    private final DateTimeFormatter label;

    Granularity(String pattern) {
        this.label = DateTimeFormatter.ofPattern(pattern);
    }

    public static Granularity forDays(long days) {
        return days <= MAX_DAYS_BY_DAY ? DAY : MONTH;
    }

    /**
     * The bucket a day falls into: the day itself, or the first of its month.
     */
    public LocalDate bucketOf(LocalDate day) {
        return this == DAY ? day : day.withDayOfMonth(1);
    }

    public LocalDate next(LocalDate bucket) {
        return this == DAY ? bucket.plusDays(1) : bucket.plusMonths(1);
    }

    public String label(LocalDate bucket) {
        return bucket.format(label);
    }

    /**
     * Value sent to the frontend.
     */
    public String code() {
        return name().toLowerCase(Locale.ROOT);
    }
}
