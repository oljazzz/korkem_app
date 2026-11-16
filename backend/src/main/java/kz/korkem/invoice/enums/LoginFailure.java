package kz.korkem.invoice.enums;

/** Why a login failed, as recorded in the audit log (never shown to the person logging in). */
public enum LoginFailure {
    BAD_PASSWORD, UNKNOWN_USER, DISABLED
}
