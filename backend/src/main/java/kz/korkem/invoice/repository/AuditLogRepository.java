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
                      Long entityId, String entityLabel, String changes, String traceId) {}

    private final NamedParameterJdbcTemplate jdbc;

    public void insert(Instant at, String username, AuditAction action, AuditEntityType type, Long entityId,
                       String label, String changesJson, String traceId) {
        jdbc.update("""
                insert into audit_log (at, username, action, entity_type, entity_id, entity_label, changes, trace_id)
                values (:at, :username, :action, :type, :entityId, :label, cast(:changes as json), :traceId)
                """, new MapSqlParameterSource()
                .addValue("at", Timestamp.from(at))
                .addValue("username", username)
                .addValue("action", action.name())
                .addValue("type", type.name())
                .addValue("entityId", entityId)
                .addValue("label", label == null || label.length() <= 255 ? label : label.substring(0, 255))
                .addValue("changes", changesJson)
                .addValue("traceId", traceId));
    }

    /** Newest first. */
    public List<Row> find(AuditFilter f, int page, int size) {
        SqlWhere where = where(f);
        MapSqlParameterSource params = new MapSqlParameterSource(where.params().getValues())
                .addValue("limit", size).addValue("offset", (long) page * size);
        return jdbc.query("""
                select id, at, username, action, entity_type, entity_id, entity_label, changes::text as changes, trace_id
                from audit_log a""" + where.sql() + """
                 order by at desc, id desc limit :limit offset :offset
                """, params, (rs, n) -> new Row(rs.getLong("id"), rs.getTimestamp("at").toInstant(),
                rs.getString("username"), AuditAction.valueOf(rs.getString("action")),
                AuditEntityType.valueOf(rs.getString("entity_type")), rs.getObject("entity_id", Long.class),
                rs.getString("entity_label"), rs.getString("changes"), rs.getString("trace_id")));
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
