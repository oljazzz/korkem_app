package kz.korkem.invoice.service;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import kz.korkem.invoice.dto.ClientDtos.CityCount;
import kz.korkem.invoice.dto.ClientDtos.ClientDto;
import kz.korkem.invoice.dto.ClientDtos.ClientRequest;
import kz.korkem.invoice.dto.ClientDtos.ClientSummary;
import kz.korkem.invoice.dto.ClientDtos.DebtorDto;
import kz.korkem.invoice.dto.ClientDtos.Debts;
import kz.korkem.invoice.dto.ClientDtos.MergePlan;
import kz.korkem.invoice.dto.ClientDtos.MergeResult;
import kz.korkem.invoice.dto.ClientDtos.MergeSide;
import kz.korkem.invoice.dto.InvoiceDtos.InvoiceDto;
import kz.korkem.invoice.dto.PageResponse;
import kz.korkem.invoice.entities.Client;
import kz.korkem.invoice.exception.NotFoundException;
import kz.korkem.invoice.mapper.ClientMapper;
import kz.korkem.invoice.repository.ClientRepository;
import kz.korkem.invoice.repository.query.ClientBalanceQuery;
import kz.korkem.invoice.util.Texts;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Clients: the card with debt and purchase figures, debtors, and editing. Merging is in ClientMergeService. */
@Service
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class ClientService {

    private static final int RECENT_INVOICES = 10;
    private static final int TOP_PRODUCTS = 8;

    private final ClientRepository clients;
    private final ClientBalanceQuery balances;
    private final ClientMergeService merger;
    private final InvoiceService invoices;
    private final ClientMapper mapper;

    public PageResponse<ClientDto> search(String q, String city, int page, int size) {
        var result = clients.search(q.trim(), city.trim(),
                PageRequest.of(page, PageResponse.clampSize(size), Sort.by(Sort.Direction.DESC, "name")));
        Map<Long, BigDecimal> debts = balances.debts(result.map(Client::getId).getContent());
        return PageResponse.of(result, c -> mapper.toDto(c, debts.getOrDefault(c.getId(), BigDecimal.ZERO)));
    }

    /** Towns/markets entered for clients, with how many clients each has. */
    public List<CityCount> cities() {
        return clients.cities().stream().map(r -> new CityCount((String) r[0], (Long) r[1])).toList();
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

    public ClientDto get(Long id) {
        return withDebt(find(id));
    }

    public ClientSummary summary(Long id) {
        Client c = find(id);
        var stats = balances.stats(id);
        var recent = invoices.list("", id, null, null, false, 0, RECENT_INVOICES).items();
        return new ClientSummary(withDebt(c), stats.invoiceCount(), stats.total(), stats.lastInvoiceAt(), recent,
                balances.topProducts(id, TOP_PRODUCTS));
    }

    /** The client's latest invoice, to repeat the order. */
    public InvoiceDto lastInvoice(Long id) {
        find(id);
        return invoices.lastForClient(id);
    }

    @Transactional
    public ClientDto create(ClientRequest req) {
        Client c = new Client();
        apply(c, req);
        return withDebt(clients.save(c));
    }

    @Transactional
    public ClientDto update(Long id, ClientRequest req) {
        Client c = find(id);
        apply(c, req);
        clients.flush();
        return withDebt(c);
    }

    @Transactional
    public void delete(Long id) {
        clients.delete(find(id));
        clients.flush(); // surface the FK violation here so it maps to 409 when the client has invoices
    }

    // --- merging duplicates (the rules live in ClientMergeService) ---

    /** Clients sharing a phone number; in each group the first one would stay after a merge. */
    public List<List<MergeSide>> duplicates() {
        return merger.duplicatesByPhone().stream().map(g -> g.stream().map(this::side).toList()).toList();
    }

    public MergePlan mergePlan(Long clientId, Long otherId) {
        var plan = merger.plan(clientId, otherId);
        return new MergePlan(side(plan.primary()), side(plan.secondary()));
    }

    @Transactional
    public MergeResult merge(Long clientId, Long otherId) {
        var r = merger.merge(clientId, otherId);
        return new MergeResult(withDebt(r.primary()), r.movedInvoices(), r.removedName());
    }

    private MergeSide side(ClientMergeService.Side s) {
        return new MergeSide(withDebt(s.client()), s.invoiceCount(), s.lastInvoiceAt());
    }

    private ClientDto withDebt(Client c) {
        return mapper.toDto(c, balances.debts(List.of(c.getId())).getOrDefault(c.getId(), BigDecimal.ZERO));
    }

    private static void apply(Client c, ClientRequest req) {
        c.setName(req.name().trim());
        c.setAddress(Texts.clean(req.address()));
        c.setPhone(Texts.clean(req.phone()));
        c.setCity(Texts.clean(req.city()));
        c.setNote(Texts.clean(req.note()));
        c.setOpeningDebt(req.openingDebt() == null ? BigDecimal.ZERO : req.openingDebt());
    }

    private Client find(Long id) {
        return clients.findById(id).orElseThrow(() -> new NotFoundException("error.client.notFound"));
    }
}
