package kz.korkem.invoice.user;

/**
 * Access roles.
 * ADMIN   — everything, including user management and deleting records.
 * MANAGER — invoices, price list, clients, categories and reports; cannot manage users or delete records.
 */
public enum Role {
    ADMIN,
    MANAGER
}
