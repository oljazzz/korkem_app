package kz.korkem.invoice.report;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Locale;

/** How the dashboard trend is bucketed: by day for up to two months, by month beyond that. */
enum Granularity {
    DAY("dd.MM"),
    MONTH("MM.yyyy");

    private static final int MAX_DAYS_BY_DAY = 62;

    private final DateTimeFormatter label;

    Granularity(String pattern) {
        this.label = DateTimeFormatter.ofPattern(pattern);
    }

    static Granularity forDays(long days) {
        return days <= MAX_DAYS_BY_DAY ? DAY : MONTH;
    }

    /** The bucket a day falls into: the day itself, or the first of its month. */
    LocalDate bucketOf(LocalDate day) {
        return this == DAY ? day : day.withDayOfMonth(1);
    }

    LocalDate next(LocalDate bucket) {
        return this == DAY ? bucket.plusDays(1) : bucket.plusMonths(1);
    }

    String label(LocalDate bucket) {
        return bucket.format(label);
    }

    /** Value sent to the frontend. */
    String code() {
        return name().toLowerCase(Locale.ROOT);
    }
}
