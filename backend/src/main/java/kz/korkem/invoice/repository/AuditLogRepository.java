package kz.korkem.invoice.repository;

import static kz.korkem.invoice.constants.DateProps.startOf;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import kz.korkem.invoice.dto.AuditDtos.AuditFilter;
import kz.korkem.invoice.enums.AuditAction;
import kz.korkem.invoice.enums.AuditEntityType;
import kz.korkem.invoice.repository.query.SqlWhere;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

/**
 * The append-only audit_log table, through JDBC: rows are only inserted and read (json is simpler
 * this way than as a JPA entity). Runs in the caller's transaction, so a change that rolls back
 * leaves no entry.
 */
@Repository
@RequiredArgsConstructor
public class AuditLogRepository {

    /** A stored entry; {@code changes} is the json text. */
    public record Row(long id, Instant at, String username, AuditAction action, AuditEntityType entityType,
                      Long entityId, String entityLabel, String changes, String traceId, String ip) {}

    private final NamedParameterJdbcTemplate jdbc;

    public void insert(Instant at, String username, AuditAction action, AuditEntityType type, Long entityId,
                       String label, String changesJson, String traceId, String ip) {
        jdbc.update("""
                insert into audit_log (at, username, action, entity_type, entity_id, entity_label, changes, trace_id, ip)
                values (:at, :username, :action, :type, :entityId, :label, cast(:changes as json), :traceId, :ip)
                """, new MapSqlParameterSource()
                .addValue("at", Timestamp.from(at))
                .addValue("username", cut(username, 100))
                .addValue("action", action.name())
                .addValue("type", type.name())
                .addValue("entityId", entityId)
                .addValue("label", cut(label, 255))
                .addValue("changes", changesJson)
                .addValue("traceId", traceId)
                .addValue("ip", cut(ip, 45)));
    }

    /**
     * When the {@code n}-th most recent failed login for this username happened, counting only
     * failures after {@code since} and after the user's last successful login; null if there are fewer.
     */
    public Instant nthFailedLoginOfUser(String username, Instant since, int n) {
        return nth("""
                select at from audit_log
                where action = 'LOGIN_FAILED' and lower(username) = lower(:key) and at >= :since
                  and at > coalesce((select max(at) from audit_log
                                     where action = 'LOGIN' and lower(username) = lower(:key)), '-infinity')
                order by at desc offset :skip limit 1
                """, username, since, n);
    }

    /** Like {@link #nthFailedLoginOfUser}, for every failure from one IP (successes do not reset it). */
    public Instant nthFailedLoginFromIp(String ip, Instant since, int n) {
        return nth("""
                select at from audit_log
                where action = 'LOGIN_FAILED' and ip = :key and at >= :since
                order by at desc offset :skip limit 1
                """, ip, since, n);
    }

    private Instant nth(String sql, String key, Instant since, int n) {
        if (key == null) return null;
        List<Instant> at = jdbc.query(sql, new MapSqlParameterSource()
                        .addValue("key", key).addValue("since", Timestamp.from(since)).addValue("skip", n - 1),
                (rs, i) -> rs.getTimestamp("at").toInstant());
        return at.isEmpty() ? null : at.getFirst();
    }

    private static String cut(String s, int max) {
        return s == null || s.length() <= max ? s : s.substring(0, max);
    }

    /** Newest first. */
    public List<Row> find(AuditFilter f, int page, int size) {
        SqlWhere where = where(f);
        MapSqlParameterSource params = new MapSqlParameterSource(where.params().getValues())
                .addValue("limit", size).addValue("offset", (long) page * size);
        return jdbc.query("""
                select id, at, username, action, entity_type, entity_id, entity_label, changes::text as changes, trace_id, ip
                from audit_log a""" + where.sql() + """
                 order by at desc, id desc limit :limit offset :offset
                """, params, (rs, n) -> new Row(rs.getLong("id"), rs.getTimestamp("at").toInstant(),
                rs.getString("username"), AuditAction.valueOf(rs.getString("action")),
                AuditEntityType.valueOf(rs.getString("entity_type")), rs.getObject("entity_id", Long.class),
                rs.getString("entity_label"), rs.getString("changes"), rs.getString("trace_id"),
                rs.getString("ip")));
    }

    public long count(AuditFilter f) {
        SqlWhere where = where(f);
        Long n = jdbc.queryForObject("select count(*) from audit_log a" + where.sql(), where.params(), Long.class);
        return n == null ? 0 : n;
    }

    private static SqlWhere where(AuditFilter f) {
        return new SqlWhere()
                .eq("a.entity_type", "type", f.entityType() == null ? null : f.entityType().name())
                .eq("a.entity_id", "entityId", f.entityId())
                .and("lower(a.username) = lower(:username)", "username", f.username())
                .eq("a.action", "action", f.action() == null ? null : f.action().name())
                .atLeast("a.at", "from", startOf(f.from()))
                .before("a.at", "to", f.to() == null ? null : startOf(f.to().plusDays(1)));
    }
}
