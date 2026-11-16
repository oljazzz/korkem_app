package kz.korkem.invoice.enums;

/** What happened in the audit log: a change to a record, or a sign-in event of a user. */
public enum AuditAction {
    CREATE, UPDATE, DELETE,
    /** Two clients became one, or several products became one product with colours. */
    MERGE,
    LOGIN,
    /** A wrong password, unknown login or disabled user; these are what throttling counts. */
    LOGIN_FAILED,
    /** Every session of the user was ended (tokens revoked). */
    LOGOUT_ALL
}
