package kz.korkem.invoice.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import kz.korkem.invoice.dto.ClientDtos.ClientDto;
import kz.korkem.invoice.enums.PaymentMethod;

/** The reconciliation statement (акт сверки) of a client over a period. */
public final class ReconciliationDtos {

    private ReconciliationDtos() {}

    public enum EntryKind { INVOICE, PAYMENT }

    /**
     * One movement: an invoice raises the client's debt ({@code debit}), a payment lowers it
     * ({@code credit}). A payment names the invoice it paid; {@code method} is set for payments only.
     * An invoice from before payments were tracked ({@code legacyPaid}) counts as settled when issued:
     * its debit and credit are both its total.
     */
    public record Entry(LocalDate date, EntryKind kind, Long invoiceId, long invoiceNumber, PaymentMethod method,
                        boolean legacyPaid, BigDecimal debit, BigDecimal credit) {}

    /**
     * {@code opening}: what the client owed at the start of {@code from} (opening debt included);
     * {@code closing}: at the end of {@code to}. Positive means the client owes us, negative that we owe them.
     */
    public record Reconciliation(ClientDto client, LocalDate from, LocalDate to, BigDecimal opening,
                                 List<Entry> entries, BigDecimal debit, BigDecimal credit, BigDecimal closing) {}
}
