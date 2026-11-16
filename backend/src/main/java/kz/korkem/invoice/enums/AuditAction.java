package kz.korkem.invoice.enums;

/** What happened to a record in the audit log. */
public enum AuditAction {
    CREATE, UPDATE, DELETE,
    /** Two clients became one, or several products became one product with colours. */
    MERGE
}
