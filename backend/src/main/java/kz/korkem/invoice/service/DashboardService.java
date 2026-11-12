package kz.korkem.invoice.service;

import static kz.korkem.invoice.constants.DateProps.ZONE;
import static kz.korkem.invoice.constants.DateProps.startOf;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import kz.korkem.invoice.dto.ReportDtos.Dashboard;
import kz.korkem.invoice.dto.ReportDtos.Kpi;
import kz.korkem.invoice.dto.ReportDtos.Point;
import kz.korkem.invoice.enums.Granularity;
import kz.korkem.invoice.exception.BadRequestException;
import kz.korkem.invoice.properties.Messages;
import kz.korkem.invoice.repository.query.DashboardQuery;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Dashboard figures for a period: revenue and other KPIs compared with the period of the same length
 * right before it, the revenue trend, and the top products, clients and categories.
 */
@Service
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class DashboardService {

    private static final int TOP = 8;

    /** One invoice's total, on its Almaty day. */
    private record Inv(LocalDate day, Long clientId, BigDecimal total, BigDecimal vat) {}

    private final DashboardQuery query;
    private final Messages messages;

    public Dashboard dashboard(LocalDate from, LocalDate to) {
        if (to.isBefore(from)) {
            throw new BadRequestException("error.report.badPeriod");
        }
        long days = ChronoUnit.DAYS.between(from, to) + 1;
        Granularity granularity = Granularity.forDays(days);

        List<Inv> invs = invoices(from.minusDays(days), to);
        List<Inv> current = invs.stream().filter(i -> !i.day().isBefore(from)).toList();
        List<Inv> previous = invs.stream().filter(i -> i.day().isBefore(from)).toList();

        Instant start = startOf(from);
        Instant end = startOf(to.plusDays(1));
        return new Dashboard(from, to, granularity.code(), kpi(current), kpi(previous),
                series(current, from, to, granularity),
                query.topProducts(start, end, TOP), query.topClients(start, end, TOP),
                query.categories(start, end, messages.get("report.noCategory")),
                query.lastInvoiceAt());
    }

    /** Per-invoice totals from {@code from} to {@code to}, on Almaty days (not the database's). */
    private List<Inv> invoices(LocalDate from, LocalDate to) {
        return query.invoiceTotals(startOf(from), startOf(to.plusDays(1))).stream()
                .map(t -> new Inv(t.createdAt().atZone(ZONE).toLocalDate(), t.clientId(), t.total(), t.vat()))
                .toList();
    }

    /** Revenue and invoice count per day or month; buckets without sales are kept as zero. */
    private static List<Point> series(List<Inv> invs, LocalDate from, LocalDate to, Granularity g) {
        Map<LocalDate, BigDecimal> revenue = new LinkedHashMap<>();
        Map<LocalDate, Long> count = new LinkedHashMap<>();
        for (LocalDate d = g.bucketOf(from); !d.isAfter(to); d = g.next(d)) {
            revenue.put(d, BigDecimal.ZERO);
            count.put(d, 0L);
        }
        for (Inv i : invs) {
            LocalDate bucket = g.bucketOf(i.day());
            if (revenue.containsKey(bucket)) {
                revenue.merge(bucket, i.total(), BigDecimal::add);
                count.merge(bucket, 1L, Long::sum);
            }
        }
        return revenue.keySet().stream()
                .map(d -> new Point(g.label(d), d, revenue.get(d), count.get(d)))
                .toList();
    }

    private static Kpi kpi(List<Inv> invs) {
        BigDecimal revenue = invs.stream().map(Inv::total).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal vat = invs.stream().map(Inv::vat).reduce(BigDecimal.ZERO, BigDecimal::add);
        long clients = invs.stream().map(Inv::clientId).filter(Objects::nonNull).distinct().count();
        long count = invs.size();
        return new Kpi(revenue, count,
                count == 0 ? BigDecimal.ZERO : revenue.divide(BigDecimal.valueOf(count), 2, RoundingMode.HALF_UP),
                vat, clients);
    }
}
