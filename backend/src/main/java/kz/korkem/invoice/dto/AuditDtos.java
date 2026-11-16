package kz.korkem.invoice.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Map;
import kz.korkem.invoice.enums.AuditAction;
import kz.korkem.invoice.enums.AuditEntityType;

/** Audit log entries and the filter for listing them. */
public final class AuditDtos {

    private AuditDtos() {}

    /** One field's change; {@code old} is absent on creation, {@code new} on deletion. */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record Change(Object old, @JsonProperty("new") Object next) {}

    public record AuditEntryDto(Long id, Instant at, String username, AuditAction action, AuditEntityType entityType,
                                Long entityId, String entityLabel, Map<String, Change> changes, String traceId) {}

    /** Every field is optional; [from, to] are Almaty days, both inclusive. */
    public record AuditFilter(AuditEntityType entityType, Long entityId, String username, AuditAction action,
                              LocalDate from, LocalDate to) {}
}
