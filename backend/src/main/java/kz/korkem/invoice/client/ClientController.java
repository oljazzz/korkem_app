package kz.korkem.invoice.client;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import kz.korkem.invoice.common.NotFoundException;
import kz.korkem.invoice.common.PageResponse;
import kz.korkem.invoice.invoice.InvoiceDtos.InvoiceDto;
import kz.korkem.invoice.invoice.InvoiceDtos.InvoiceListItem;
import kz.korkem.invoice.invoice.InvoiceService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/clients")
@RequiredArgsConstructor
public class ClientController {

    public record ClientDto(Long id, String name, String address, String phone, String city, String note,
                            BigDecimal openingDebt, String displayName, String label, String place, BigDecimal debt) {
        static ClientDto of(Client c, BigDecimal debt) {
            return new ClientDto(c.getId(), c.getName(), c.getAddress(), c.getPhone(), c.getCity(), c.getNote(),
                    c.getOpeningDebt(), c.getDisplayName(), c.getLabel(), c.getPlace(), debt);
        }
    }

    public record CityCount(String city, long clients) {}

    public record ClientRequest(
            @NotBlank(message = "Атын енгізіңіз") @Size(max = 255, message = "Аты тым ұзын") String name,
            @Size(max = 1000, message = "Мекенжайы тым ұзын") String address,
            @Size(max = 100, message = "Телефон тым ұзын") String phone,
            @Size(max = 255, message = "Тым ұзын") String city,
            @Size(max = 1000, message = "Ескертпе тым ұзын") String note,
            @DecimalMin(value = "0", message = "Бастапқы қарыз теріс болмауы керек") BigDecimal openingDebt) {}

    /** Client card: details, purchase figures, debt, recent invoices and favourite products. */
    public record ClientSummary(ClientDto client, long invoiceCount, BigDecimal total, Instant lastInvoiceAt,
                                List<InvoiceListItem> recentInvoices, List<ClientBalances.TopProduct> topProducts) {}

    public record DebtorDto(ClientDto client, BigDecimal debt) {}

    public record Debts(BigDecimal total, List<DebtorDto> debtors) {}

    /** A client in a merge or duplicate list, with the figures that decide which record stays. */
    public record MergeSide(ClientDto client, long invoiceCount, Instant lastInvoiceAt) {}

    public record MergePlan(MergeSide primary, MergeSide secondary) {}

    public record MergeRequest(@jakarta.validation.constraints.NotNull(message = "Клиентті таңдаңыз") Long clientId,
                               @jakarta.validation.constraints.NotNull(message = "Клиентті таңдаңыз") Long otherId) {}

    public record MergeResult(ClientDto primary, int movedInvoices, String removedName) {}

    private final ClientRepository repo;
    private final ClientBalances balances;
    private final InvoiceService invoices;
    private final ClientMergeService merger;

    @GetMapping
    public PageResponse<ClientDto> list(@RequestParam(defaultValue = "") String q,
                                        @RequestParam(defaultValue = "") String city,
                                        @RequestParam(defaultValue = "0") int page,
                                        @RequestParam(defaultValue = "50") int size) {
        var result = repo.search(q.trim(), city.trim(),
                PageRequest.of(page, PageResponse.clampSize(size), Sort.by(Sort.Direction.DESC, "name")));
        Map<Long, BigDecimal> debts = balances.debts(result.map(Client::getId).getContent());
        return PageResponse.of(result, c -> ClientDto.of(c, debts.getOrDefault(c.getId(), BigDecimal.ZERO)));
    }

    /** Towns/markets entered for clients, with how many clients each has. */
    @GetMapping("/cities")
    public List<CityCount> cities() {
        return repo.cities().stream().map(r -> new CityCount((String) r[0], (Long) r[1])).toList();
    }

    /** Clients that owe money, largest first, with the total owed. */
    @GetMapping("/debtors")
    public Debts debtors(@RequestParam(defaultValue = "50") int limit) {
        var rows = balances.debtors(PageResponse.clampSize(limit));
        Map<Long, Client> byId = repo.findAllById(rows.stream().map(ClientBalances.Debtor::clientId).toList())
                .stream().collect(Collectors.toMap(Client::getId, Function.identity()));
        return new Debts(balances.totalDebt(), rows.stream()
                .filter(r -> byId.containsKey(r.clientId()))
                .map(r -> new DebtorDto(ClientDto.of(byId.get(r.clientId()), r.debt()), r.debt()))
                .toList());
    }

    /** Clients sharing a phone number; in each group the first one would stay after a merge. */
    @GetMapping("/duplicates")
    public List<List<MergeSide>> duplicates() {
        return merger.duplicatesByPhone().stream().map(g -> g.stream().map(this::side).toList()).toList();
    }

    /** Which of the two clients would stay (newer last invoice) and which would be removed. */
    @GetMapping("/merge-plan")
    public MergePlan mergePlan(@RequestParam Long clientId, @RequestParam Long otherId) {
        var plan = merger.plan(clientId, otherId);
        return new MergePlan(side(plan.primary()), side(plan.secondary()));
    }

    /** Merges two clients (admin only, see SecurityConfig): invoices move to the primary, the other is deleted. */
    @PostMapping("/merge")
    public MergeResult merge(@Valid @RequestBody MergeRequest req) {
        var r = merger.merge(req.clientId(), req.otherId());
        return new MergeResult(withDebt(r.primary()), r.movedInvoices(), r.removedName());
    }

    @GetMapping("/{id}")
    public ClientDto get(@PathVariable Long id) {
        return withDebt(find(id));
    }

    @GetMapping("/{id}/summary")
    @Transactional(readOnly = true)
    public ClientSummary summary(@PathVariable Long id) {
        Client c = find(id);
        var stats = balances.stats(id);
        var recent = invoices.list("", id, null, null, false, 0, 10).items();
        return new ClientSummary(withDebt(c), stats.invoiceCount(), stats.total(), stats.lastInvoiceAt(), recent,
                balances.topProducts(id, 8));
    }

    /** The client's latest invoice, to repeat the order. 404 when there is none. */
    @GetMapping("/{id}/last-invoice")
    public InvoiceDto lastInvoice(@PathVariable Long id) {
        find(id);
        return invoices.lastForClient(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public ClientDto create(@Valid @RequestBody ClientRequest req) {
        Client c = new Client();
        apply(c, req);
        return withDebt(repo.save(c));
    }

    @PutMapping("/{id}")
    @Transactional
    public ClientDto update(@PathVariable Long id, @Valid @RequestBody ClientRequest req) {
        Client c = find(id);
        apply(c, req);
        repo.flush();
        return withDebt(c);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void delete(@PathVariable Long id) {
        repo.delete(find(id));
        repo.flush(); // surface the FK violation here so it maps to 409 when the client has invoices
    }

    private MergeSide side(ClientMergeService.Side s) {
        return new MergeSide(withDebt(s.client()), s.invoiceCount(), s.lastInvoiceAt());
    }

    private ClientDto withDebt(Client c) {
        return ClientDto.of(c, balances.debts(List.of(c.getId())).getOrDefault(c.getId(), BigDecimal.ZERO));
    }

    private static String clean(String v) {
        return v == null || v.isBlank() ? null : v.trim();
    }

    private void apply(Client c, ClientRequest req) {
        c.setName(req.name().trim());
        c.setAddress(clean(req.address()));
        c.setPhone(clean(req.phone()));
        c.setCity(clean(req.city()));
        c.setNote(clean(req.note()));
        c.setOpeningDebt(req.openingDebt() == null ? BigDecimal.ZERO : req.openingDebt());
    }

    private Client find(Long id) {
        return repo.findById(id).orElseThrow(() -> new NotFoundException("Клиент табылмады"));
    }
}
