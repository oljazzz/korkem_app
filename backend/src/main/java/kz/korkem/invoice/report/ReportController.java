package kz.korkem.invoice.report;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.Timestamp;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.*;
import kz.korkem.invoice.common.BadRequestException;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/reports")
@EnableConfigurationProperties(CompanyProperties.class)
@Transactional(readOnly = true)
public class ReportController {

    public static final ZoneId ZONE = ZoneId.of("Asia/Almaty");

    public record SalesRow(String productName, String categoryName, BigDecimal quantity, BigDecimal avgPrice,
                           BigDecimal total, BigDecimal vat, long invoices) {}

    public record SalesReport(LocalDate from, LocalDate to, int invoiceCount, List<SalesRow> rows,
                              BigDecimal totalQuantity, BigDecimal total, BigDecimal vat) {}

    public record Kpi(BigDecimal revenue, long invoices, BigDecimal avgCheck, BigDecimal vat, long clients) {}

    public record Point(String label, LocalDate start, BigDecimal revenue, long invoices) {}

    public record Ranked(String name, BigDecimal revenue, BigDecimal quantity, long invoices) {}

    public record Dashboard(LocalDate from, LocalDate to, String granularity, Kpi current, Kpi previous,
                            List<Point> series, List<Ranked> topProducts, List<Ranked> topClients,
                            List<Ranked> categories, Instant lastInvoiceAt) {}

    private record Inv(LocalDate day, Long clientId, BigDecimal total, BigDecimal vat) {}

    private final NamedParameterJdbcTemplate jdbc;
    private final CompanyProperties company;

    public ReportController(NamedParameterJdbcTemplate jdbc, CompanyProperties company) {
        this.jdbc = jdbc;
        this.company = company;
    }

    @GetMapping("/company")
    public CompanyProperties company() {
        return company;
    }

    /**
     * «Отчет по проданным товарам»: тауар бойынша жалпы саны мен сомасы.
     * Кезең, клиент немесе нақты накладнойлар тізімі бойынша сүзуге болады.
     */
    @GetMapping("/sales")
    public SalesReport sales(@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                             @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
                             @RequestParam(required = false) Long clientId,
                             @RequestParam(required = false) List<Long> invoiceIds) {
        MapSqlParameterSource p = new MapSqlParameterSource();
        String where = filter(from, to, clientId, invoiceIds, p);
        List<SalesRow> rows = jdbc.query("""
                select l.product_name, max(c.name) as category, sum(l.quantity) as qty, sum(l.total) as total,
                       sum(l.vat) as vat, count(distinct l.invoice_id) as invoices
                from invoice_line l
                join invoice i on i.id = l.invoice_id
                left join category c on c.id = l.category_id
                """ + where + """
                 group by l.product_name
                 order by sum(l.total) desc, l.product_name
                """, p, (rs, n) -> {
            BigDecimal qty = rs.getBigDecimal("qty");
            BigDecimal total = rs.getBigDecimal("total");
            return new SalesRow(rs.getString("product_name"), rs.getString("category"), qty,
                    qty.signum() == 0 ? BigDecimal.ZERO : total.divide(qty, 2, RoundingMode.HALF_UP),
                    total, rs.getBigDecimal("vat"), rs.getLong("invoices"));
        });
        Integer invoiceCount = jdbc.queryForObject("select count(*) from invoice i " + where, p, Integer.class);
        return new SalesReport(from, to, invoiceCount == null ? 0 : invoiceCount, rows,
                sum(rows, SalesRow::quantity), sum(rows, SalesRow::total), sum(rows, SalesRow::vat));
    }

    /** Бас беттегі көрсеткіштер: кезең бойынша түсім, алдыңғы кезеңмен салыстыру, динамика, топтар. */
    @GetMapping("/dashboard")
    public Dashboard dashboard(@RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                               @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        if (to.isBefore(from)) throw new BadRequestException("Кезең қате");
        long days = ChronoUnit.DAYS.between(from, to) + 1;
        LocalDate prevFrom = from.minusDays(days);
        String granularity = days <= 62 ? "day" : "month";

        // Әр накладнойдың сомасы (алдыңғы кезеңмен бірге) — агрегацияны Java-да жасаймыз (уақыт белдеуі үшін)
        MapSqlParameterSource p = new MapSqlParameterSource()
                .addValue("from", start(prevFrom)).addValue("to", start(to.plusDays(1)));
        List<Inv> invs = jdbc.query("""
                select i.created_at, i.client_id, coalesce(sum(l.total), 0) as total, coalesce(sum(l.vat), 0) as vat
                from invoice i left join invoice_line l on l.invoice_id = i.id
                where i.created_at >= :from and i.created_at < :to
                group by i.id, i.created_at, i.client_id
                """, p, (rs, n) -> new Inv(
                rs.getTimestamp("created_at").toInstant().atZone(ZONE).toLocalDate(),
                (Long) rs.getObject("client_id", Long.class), rs.getBigDecimal("total"), rs.getBigDecimal("vat")));

        List<Inv> cur = invs.stream().filter(i -> !i.day().isBefore(from)).toList();
        List<Inv> prev = invs.stream().filter(i -> i.day().isBefore(from)).toList();

        Map<LocalDate, BigDecimal[]> buckets = new LinkedHashMap<>();
        for (LocalDate d = bucket(from, granularity); !d.isAfter(to); d = granularity.equals("day") ? d.plusDays(1) : d.plusMonths(1)) {
            buckets.put(d, new BigDecimal[] {BigDecimal.ZERO, BigDecimal.ZERO});
        }
        for (Inv i : cur) {
            BigDecimal[] b = buckets.get(bucket(i.day(), granularity));
            if (b != null) {
                b[0] = b[0].add(i.total());
                b[1] = b[1].add(BigDecimal.ONE);
            }
        }
        DateTimeFormatter fmt = DateTimeFormatter.ofPattern(granularity.equals("day") ? "dd.MM" : "MM.yyyy");
        List<Point> series = buckets.entrySet().stream()
                .map(e -> new Point(e.getKey().format(fmt), e.getKey(), e.getValue()[0], e.getValue()[1].longValue()))
                .toList();

        MapSqlParameterSource range = new MapSqlParameterSource()
                .addValue("from", start(from)).addValue("to", start(to.plusDays(1)));
        List<Ranked> topProducts = jdbc.query("""
                select l.product_name as name, sum(l.total) as revenue, sum(l.quantity) as qty,
                       count(distinct l.invoice_id) as invoices
                from invoice_line l join invoice i on i.id = l.invoice_id
                where i.created_at >= :from and i.created_at < :to
                group by l.product_name order by sum(l.total) desc limit 8
                """, range, this::ranked);
        List<Ranked> topClients = jdbc.query("""
                select c.name as name, sum(l.total) as revenue, sum(l.quantity) as qty,
                       count(distinct i.id) as invoices
                from invoice i join client c on c.id = i.client_id
                join invoice_line l on l.invoice_id = i.id
                where i.created_at >= :from and i.created_at < :to
                group by c.id, c.name order by sum(l.total) desc limit 8
                """, range, this::ranked);
        List<Ranked> categories = jdbc.query("""
                select coalesce(c.name, 'Без категории') as name, sum(l.total) as revenue, sum(l.quantity) as qty,
                       count(distinct l.invoice_id) as invoices
                from invoice_line l join invoice i on i.id = l.invoice_id
                left join category c on c.id = l.category_id
                where i.created_at >= :from and i.created_at < :to
                group by coalesce(c.name, 'Без категории') order by sum(l.total) desc
                """, range, this::ranked);

        Timestamp last = jdbc.queryForObject("select max(created_at) from invoice", new MapSqlParameterSource(), Timestamp.class);
        return new Dashboard(from, to, granularity, kpi(cur), kpi(prev), series, topProducts, topClients,
                categories, last == null ? null : last.toInstant());
    }

    private Ranked ranked(java.sql.ResultSet rs, int n) throws java.sql.SQLException {
        return new Ranked(rs.getString("name"), rs.getBigDecimal("revenue"), rs.getBigDecimal("qty"), rs.getLong("invoices"));
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

    private static LocalDate bucket(LocalDate d, String granularity) {
        return granularity.equals("day") ? d : d.withDayOfMonth(1);
    }

    private static Timestamp start(LocalDate d) {
        return Timestamp.from(d.atStartOfDay(ZONE).toInstant());
    }

    private static String filter(LocalDate from, LocalDate to, Long clientId, List<Long> ids, MapSqlParameterSource p) {
        List<String> cond = new ArrayList<>();
        if (from != null) {
            cond.add("i.created_at >= :from");
            p.addValue("from", start(from));
        }
        if (to != null) {
            cond.add("i.created_at < :to");
            p.addValue("to", start(to.plusDays(1)));
        }
        if (clientId != null) {
            cond.add("i.client_id = :clientId");
            p.addValue("clientId", clientId);
        }
        if (ids != null && !ids.isEmpty()) {
            cond.add("i.id in (:ids)");
            p.addValue("ids", ids);
        }
        return cond.isEmpty() ? "" : " where " + String.join(" and ", cond);
    }

    private static <T> BigDecimal sum(List<T> rows, java.util.function.Function<T, BigDecimal> f) {
        return rows.stream().map(f).filter(Objects::nonNull).reduce(BigDecimal.ZERO, BigDecimal::add);
    }
}
