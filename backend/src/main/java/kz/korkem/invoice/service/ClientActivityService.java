package kz.korkem.invoice.service;

import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import kz.korkem.invoice.dto.ClientDtos.ClientSummary;
import kz.korkem.invoice.dto.ClientDtos.DebtorDto;
import kz.korkem.invoice.dto.ClientDtos.Debts;
import kz.korkem.invoice.dto.InvoiceDtos.InvoiceDto;
import kz.korkem.invoice.dto.PageResponse;
import kz.korkem.invoice.entities.Client;
import kz.korkem.invoice.exception.NotFoundException;
import kz.korkem.invoice.mapper.ClientMapper;
import kz.korkem.invoice.repository.ClientRepository;
import kz.korkem.invoice.repository.query.ClientBalanceQuery;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** What clients bought and owe: the client card's figures, the last invoice to repeat, and the debtors list. */
@Service
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class ClientActivityService {

    private static final int RECENT_INVOICES = 10;
    private static final int TOP_PRODUCTS = 8;

    private final ClientRepository clients;
    private final ClientBalanceQuery balances;
    private final InvoiceService invoices;
    private final ClientMapper mapper;

    public ClientSummary summary(Long id) {
        Client c = find(id);
        var stats = balances.stats(id);
        var recent = invoices.recentForClient(id, RECENT_INVOICES);
        return new ClientSummary(mapper.toDto(c, balances.debt(id)), stats.invoiceCount(), stats.total(),
                stats.lastInvoiceAt(), recent, balances.topProducts(id, TOP_PRODUCTS));
    }

    /** The client's latest invoice, to repeat the order. */
    public InvoiceDto lastInvoice(Long id) {
        find(id);
        return invoices.lastForClient(id);
    }

    /** Clients that owe money, largest first, with the total owed. */
    public Debts debtors(int limit) {
        var rows = balances.debtors(PageResponse.clampSize(limit));
        Map<Long, Client> byId = clients.findAllById(rows.stream().map(ClientBalanceQuery.Debtor::clientId).toList())
                .stream().collect(Collectors.toMap(Client::getId, Function.identity()));
        return new Debts(balances.totalDebt(), rows.stream()
                .filter(r -> byId.containsKey(r.clientId()))
                .map(r -> new DebtorDto(mapper.toDto(byId.get(r.clientId()), r.debt()), r.debt()))
                .toList());
    }

    private Client find(Long id) {
        return clients.findById(id).orElseThrow(() -> new NotFoundException("error.client.notFound"));
    }
}
