package kz.korkem.invoice.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import kz.korkem.invoice.dto.InvoiceDtos.InvoiceListItem;

/** Request and response bodies of /api/clients. */
public final class ClientDtos {

    private ClientDtos() {}

    /** {@code debt} = opening debt + what is still owed on invoices. */
    public record ClientDto(Long id, String name, String address, String phone, String city, String note,
                            BigDecimal openingDebt, String displayName, String label, String place, BigDecimal debt) {}

    public record ClientRequest(
            @NotBlank(message = "{validation.client.name.required}") @Size(max = 255, message = "{validation.client.name.tooLong}") String name,
            @Size(max = 1000, message = "{validation.address.tooLong}") String address,
            @Size(max = 100, message = "{validation.phone.tooLong}") String phone,
            @Size(max = 255, message = "{validation.tooLong}") String city,
            @Size(max = 1000, message = "{validation.note.tooLong}") String note,
            @DecimalMin(value = "0", message = "{validation.openingDebt.negative}") BigDecimal openingDebt) {}

    public record CityCount(String city, long clients) {}

    public record TopProduct(String name, BigDecimal quantity, BigDecimal total, long invoices) {}

    /** Client card: details, purchase figures, debt, recent invoices and favourite products. */
    public record ClientSummary(ClientDto client, long invoiceCount, BigDecimal total, Instant lastInvoiceAt,
                                List<InvoiceListItem> recentInvoices, List<TopProduct> topProducts) {}

    public record DebtorDto(ClientDto client, BigDecimal debt) {}

    public record Debts(BigDecimal total, List<DebtorDto> debtors) {}

    /** A client in a merge or duplicate list, with the figures that decide which record stays. */
    public record MergeSide(ClientDto client, long invoiceCount, Instant lastInvoiceAt) {}

    public record MergePlan(MergeSide primary, MergeSide secondary) {}

    public record MergeRequest(@NotNull(message = "{validation.client.required}") Long clientId,
                               @NotNull(message = "{validation.client.required}") Long otherId) {}

    public record MergeResult(ClientDto primary, int movedInvoices, String removedName) {}
}
