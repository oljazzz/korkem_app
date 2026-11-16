package kz.korkem.invoice.controller;

import java.time.LocalDate;
import kz.korkem.invoice.dto.AuditDtos.AuditEntryDto;
import kz.korkem.invoice.dto.AuditDtos.AuditFilter;
import kz.korkem.invoice.dto.PageResponse;
import kz.korkem.invoice.enums.AuditAction;
import kz.korkem.invoice.enums.AuditEntityType;
import kz.korkem.invoice.security.AdminOnly;
import kz.korkem.invoice.service.AuditService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.format.annotation.DateTimeFormat.ISO;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** The audit log, read-only and for admins. There is no way to change or delete entries. */
@AdminOnly
@RestController
@RequestMapping("/api/audit")
@RequiredArgsConstructor
public class AuditController {

    private final AuditService audit;

    @GetMapping
    public PageResponse<AuditEntryDto> list(@RequestParam(required = false) AuditEntityType entityType,
                                            @RequestParam(required = false) Long entityId,
                                            @RequestParam(required = false) String username,
                                            @RequestParam(required = false) AuditAction action,
                                            @RequestParam(required = false) @DateTimeFormat(iso = ISO.DATE) LocalDate from,
                                            @RequestParam(required = false) @DateTimeFormat(iso = ISO.DATE) LocalDate to,
                                            @RequestParam(defaultValue = "0") int page,
                                            @RequestParam(defaultValue = "50") int size) {
        return audit.search(new AuditFilter(entityType, entityId, username, action, from, to), page, size);
    }
}
