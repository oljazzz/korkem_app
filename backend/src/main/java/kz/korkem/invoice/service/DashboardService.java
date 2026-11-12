package kz.korkem.invoice.service;

import static kz.korkem.invoice.constants.DateProps.ZONE;
import static kz.korkem.invoice.constants.DateProps.startOf;


import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import kz.korkem.invoice.properties.Messages;

import kz.korkem.invoice.dto.ReportDtos.Dashboard;
import kz.korkem.invoice.dto.ReportDtos.Kpi;
import kz.korkem.invoice.dto.ReportDtos.Point;
import kz.korkem.invoice.dto.ReportDtos.Ranked;
import kz.korkem.invoice.enums.Granularity;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
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

    private final NamedParameterJdbcTemplate jdbc;
    private final Messages messages;

    /** {@code from} must not be after {@code to}. */
    public Dashboard dashboard(LocalDate from, LocalDate to) {
        long days = ChronoUnit.DAYS.between(from, to) + 1;
        Granularity granularity = Granularity.forDays(days);

        List<Inv> invs = invoices(from.minusDays(days), to);
        List<Inv> current = invs.stream().filter(i -> !i.day().isBefore(from)).toList();
        List<Inv> previous = invs.stream().filter(i -> i.day().isBefore(from)).toList();

        MapSqlParameterSource range = new MapSqlParameterSource()
                .addValue("from", Timestamp.from(startOf(from))).addValue("to", Timestamp.from(startOf(to.plusDays(1))));
        Timestamp last = jdbc.queryForObject("select max(created_at) from invoice", new MapSqlParameterSource(), Timestamp.class);
        return new Dashboard(from, to, granularity.code(), kpi(current), kpi(previous),
                series(current, from, to, granularity), topProducts(range), topClients(range), categories(range),
                last == null ? null : last.toInstant());
    }

    /**
     * Per-invoice totals from {@code from} to {@code to}. Summed here rather than in SQL so that days
     * follow the Almaty time zone.
     */
    private List<Inv> invoices(LocalDate from, LocalDate to) {
        MapSqlParameterSource p = new MapSqlParameterSource()
                .addValue("from", Timestamp.from(startOf(from))).addValue("to", Timestamp.from(startOf(to.plusDays(1))));
        return jdbc.query("""
                select i.created_at, i.client_id, coalesce(sum(l.total), 0) as total, coalesce(sum(l.vat), 0) as vat
                from invoice i left join invoice_line l on l.invoice_id = i.id
                where i.created_at >= :from and i.created_at < :to
                group by i.id, i.created_at, i.client_id
                """, p, (rs, n) -> new Inv(
                rs.getTimestamp("created_at").toInstant().atZone(ZONE).toLocalDate(),
                rs.getObject("client_id", Long.class), rs.getBigDecimal("total"), rs.getBigDecimal("vat")));
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

    private List<Ranked> topProducts(MapSqlParameterSource range) {
        return jdbc.query("""
                select l.product_name as name, sum(l.total) as revenue, sum(l.quantity) as qty,
                       count(distinct l.invoice_id) as invoices
                from invoice_line l join invoice i on i.id = l.invoice_id
                where i.created_at >= :from and i.created_at < :to
                group by l.product_name order by sum(l.total) desc limit :top
                """, withTop(range), DashboardService::ranked);
    }

    private List<Ranked> topClients(MapSqlParameterSource range) {
        return jdbc.query("""
                select c.id as id, c.name as name, sum(l.total) as revenue, sum(l.quantity) as qty,
                       count(distinct i.id) as invoices
                from invoice i join client c on c.id = i.client_id
                join invoice_line l on l.invoice_id = i.id
                where i.created_at >= :from and i.created_at < :to
                group by c.id, c.name order by sum(l.total) desc limit :top
                """, withTop(range), (rs, n) -> new Ranked(rs.getLong("id"), rs.getString("name"),
                rs.getBigDecimal("revenue"), rs.getBigDecimal("qty"), rs.getLong("invoices")));
    }

    /**
     * Every category's share; lines without a category are counted under one "no category" name.
     * Grouped by the first column: PostgreSQL does not see two bound :noCategory as the same expression.
     */
    private List<Ranked> categories(MapSqlParameterSource range) {
        MapSqlParameterSource p = new MapSqlParameterSource(range.getValues())
                .addValue("noCategory", messages.get("report.noCategory"));
        return jdbc.query("""
                select coalesce(c.name, :noCategory) as name, sum(l.total) as revenue, sum(l.quantity) as qty,
                       count(distinct l.invoice_id) as invoices
                from invoice_line l join invoice i on i.id = l.invoice_id
                left join category c on c.id = l.category_id
                where i.created_at >= :from and i.created_at < :to
                group by 1 order by sum(l.total) desc
                """, p, DashboardService::ranked);
    }

    private static MapSqlParameterSource withTop(MapSqlParameterSource range) {
        return new MapSqlParameterSource(range.getValues()).addValue("top", TOP);
    }

    private static Ranked ranked(ResultSet rs, int n) throws SQLException {
        return new Ranked(null, rs.getString("name"), rs.getBigDecimal("revenue"), rs.getBigDecimal("qty"), rs.getLong("invoices"));
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
