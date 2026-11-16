package kz.korkem.invoice.service;

import io.micrometer.tracing.Span;
import io.micrometer.tracing.Tracer;
import java.time.Clock;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import kz.korkem.invoice.dto.AuditDtos.AuditEntryDto;
import kz.korkem.invoice.dto.AuditDtos.AuditFilter;
import kz.korkem.invoice.dto.AuditDtos.Change;
import kz.korkem.invoice.dto.PageResponse;
import kz.korkem.invoice.enums.AuditAction;
import kz.korkem.invoice.enums.AuditEntityType;
import kz.korkem.invoice.repository.AuditLogRepository;
import kz.korkem.invoice.security.CurrentUser;
import kz.korkem.invoice.util.Snapshot;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

/**
 * The audit log: who created, changed or deleted what, with the values before and after.
 * Services call it inside their own transaction, after the change is applied, so failed changes
 * leave no entry. Deleted records keep their full last state here.
 */
@Service
@RequiredArgsConstructor
public class AuditService {

    private static final TypeReference<Map<String, Change>> CHANGES = new TypeReference<>() {};

    private final AuditLogRepository log;
    private final CurrentUser currentUser;
    private final Clock clock;
    private final JsonMapper json;
    private final ObjectProvider<Tracer> tracer;

    @Transactional(propagation = Propagation.MANDATORY)
    public void created(AuditEntityType type, Long id, String label, Snapshot state) {
        write(AuditAction.CREATE, type, id, label, diff(Map.of(), state.fields()));
    }

    /** Nothing is logged when no field changed. */
    @Transactional(propagation = Propagation.MANDATORY)
    public void updated(AuditEntityType type, Long id, String label, Snapshot before, Snapshot after) {
        Map<String, Map<String, Object>> changes = diff(before.fields(), after.fields());
        if (!changes.isEmpty()) write(AuditAction.UPDATE, type, id, label, changes);
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void deleted(AuditEntityType type, Long id, String label, Snapshot state) {
        write(AuditAction.DELETE, type, id, label, diff(state.fields(), Map.of()));
    }

    /** A merge into record {@code id}: its own changes plus {@code extra} facts (what was merged in). */
    @Transactional(propagation = Propagation.MANDATORY)
    public void merged(AuditEntityType type, Long id, String label, Snapshot before, Snapshot after, Snapshot extra) {
        Map<String, Map<String, Object>> changes = diff(before.fields(), after.fields());
        changes.putAll(facts(extra));
        write(AuditAction.MERGE, type, id, label, changes);
    }

    /** Facts with no "before" side, stored as new values. */
    private static Map<String, Map<String, Object>> facts(Snapshot s) {
        Map<String, Map<String, Object>> changes = new LinkedHashMap<>();
        s.fields().forEach((k, v) -> changes.put(k, Map.of("new", v)));
        return changes;
    }

    /**
     * A sign-in event of {@code username} (the request is not authenticated yet, or not as them).
     * Runs in a transaction of its own: a failed login is recorded although the login itself fails.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void session(AuditAction action, String username, Long userId, Snapshot details) {
        insert(username, action, AuditEntityType.USER, userId, username, facts(details));
    }

    /** Something done to a record that is not a change of its fields (e.g. its sessions were ended). */
    @Transactional(propagation = Propagation.MANDATORY)
    public void event(AuditAction action, AuditEntityType type, Long id, String label, Snapshot details) {
        write(action, type, id, label, facts(details));
    }

    @Transactional(readOnly = true)
    public PageResponse<AuditEntryDto> search(AuditFilter filter, int page, int size) {
        int pageSize = PageResponse.clampSize(size);
        var items = log.find(filter, page, pageSize).stream()
                .map(r -> new AuditEntryDto(r.id(), r.at(), r.username(), r.action(), r.entityType(), r.entityId(),
                        r.entityLabel(), json.readValue(r.changes(), CHANGES), r.traceId(), r.ip()))
                .toList();
        return new PageResponse<>(items, log.count(filter), page, pageSize);
    }

    /** Fields whose value differs, as {"field": {"old": …, "new": …}}; a missing side is left out. */
    static Map<String, Map<String, Object>> diff(Map<String, Object> before, Map<String, Object> after) {
        Set<String> fields = new LinkedHashSet<>(before.keySet());
        fields.addAll(after.keySet());
        Map<String, Map<String, Object>> changes = new LinkedHashMap<>();
        for (String f : fields) {
            Object old = before.get(f);
            Object now = after.get(f);
            if (Objects.equals(old, now)) continue;
            Map<String, Object> change = new LinkedHashMap<>();
            if (old != null) change.put("old", old);
            if (now != null) change.put("new", now);
            changes.put(f, change);
        }
        return changes;
    }

    private void write(AuditAction action, AuditEntityType type, Long id, String label,
                       Map<String, Map<String, Object>> changes) {
        insert(currentUser.username(), action, type, id, label, changes);
    }

    private void insert(String username, AuditAction action, AuditEntityType type, Long id, String label,
                        Map<String, Map<String, Object>> changes) {
        log.insert(clock.instant(), username, action, type, id, label, json.writeValueAsString(changes), traceId(),
                currentUser.ip());
    }

    private String traceId() {
        Tracer t = tracer.getIfAvailable();
        Span span = t == null ? null : t.currentSpan();
        return span == null ? null : span.context().traceId();
    }
}
