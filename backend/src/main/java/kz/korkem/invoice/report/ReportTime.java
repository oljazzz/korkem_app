package kz.korkem.invoice.report;

import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.ZoneId;

/** Reports count days in Almaty time, whatever the server's own time zone. */
final class ReportTime {

    static final ZoneId ZONE = ZoneId.of("Asia/Almaty");

    private ReportTime() {}

    /** The first moment of {@code day} in Almaty, for "created_at >= :from" style bounds. */
    static Timestamp startOf(LocalDate day) {
        return Timestamp.from(day.atStartOfDay(ZONE).toInstant());
    }
}
