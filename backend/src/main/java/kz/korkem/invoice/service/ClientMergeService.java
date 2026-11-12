package kz.korkem.invoice.service;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.TreeSet;
import kz.korkem.invoice.dto.ClientDtos.MergePlan;
import kz.korkem.invoice.dto.ClientDtos.MergeResult;
import kz.korkem.invoice.dto.ClientDtos.MergeSide;
import kz.korkem.invoice.entities.Client;
import kz.korkem.invoice.exception.BadRequestException;
import kz.korkem.invoice.exception.NotFoundException;
import kz.korkem.invoice.mapper.ClientMapper;
import kz.korkem.invoice.repository.ClientRepository;
import kz.korkem.invoice.repository.InvoiceRepository;
import kz.korkem.invoice.repository.query.ClientBalanceQuery;
import kz.korkem.invoice.repository.query.ClientBalanceQuery.Stats;
import kz.korkem.invoice.util.Phones;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Finds and merges duplicate client records. The client whose latest invoice is newer stays (primary);
 * the other one's invoices move to it and its record is deleted.
 */
@Service
@RequiredArgsConstructor
public class ClientMergeService {

    /** One side of a merge, with the figures that decide which one stays. */
    private record Side(Client client, long invoiceCount, Instant lastInvoiceAt) {}

    /** Primary = newer last invoice; then more invoices; then the older record. */
    private static final Comparator<Side> PRIMARY_FIRST = Comparator
            .comparing(Side::lastInvoiceAt, Comparator.nullsLast(Comparator.<Instant>reverseOrder()))
            .thenComparing(Side::invoiceCount, Comparator.reverseOrder())
            .thenComparing(s -> s.client().getId());

    private final ClientRepository clients;
    private final ClientBalanceQuery balances;
    private final InvoiceRepository invoices;
    private final ClientMapper mapper;

    /** Which of the two clients would stay and which would be removed. */
    @Transactional(readOnly = true)
    public MergePlan plan(Long a, Long b) {
        List<Side> sides = order(a, b);
        return new MergePlan(toDto(sides.get(0)), toDto(sides.get(1)));
    }

    @Transactional
    public MergeResult merge(Long a, Long b) {
        List<Side> sides = order(a, b);
        Client primary = sides.get(0).client();
        Client secondary = sides.get(1).client();

        int moved = invoices.moveToClient(secondary.getId(), primary.getId());

        // Keep the primary's details; take the secondary's only where the primary has none
        primary.setPhone(Phones.join(primary.getPhone(), secondary.getPhone()));
        if (blank(primary.getCity())) primary.setCity(secondary.getCity());
        if (blank(primary.getAddress())) primary.setAddress(secondary.getAddress());
        if (blank(primary.getNote())) primary.setNote(secondary.getNote());
        primary.setOpeningDebt(primary.getOpeningDebt().add(
                secondary.getOpeningDebt() == null ? BigDecimal.ZERO : secondary.getOpeningDebt()));

        String removedName = secondary.getName();
        clients.delete(secondary);
        clients.flush();
        return new MergeResult(mapper.toDto(primary, balances.debt(primary.getId())), moved, removedName);
    }

    /** Clients sharing a phone number, the most active group first; in each group the first one would stay. */
    @Transactional(readOnly = true)
    public List<List<MergeSide>> duplicates() {
        List<Set<Client>> groups = groupsByPhone();
        List<Long> ids = groups.stream().flatMap(Set::stream).map(Client::getId).distinct().toList();
        Map<Long, Stats> stats = balances.stats(ids);
        Map<Long, BigDecimal> debts = balances.debts(ids);

        List<List<Side>> sorted = new ArrayList<>();
        for (Set<Client> group : groups) {
            sorted.add(group.stream().map(c -> side(c, stats.get(c.getId()))).sorted(PRIMARY_FIRST).toList());
        }
        sorted.sort(Comparator.comparing((List<Side> g) -> g.get(0).lastInvoiceAt(),
                Comparator.nullsLast(Comparator.<Instant>reverseOrder())));
        return sorted.stream()
                .map(g -> g.stream().map(s -> toDto(s, debts.getOrDefault(s.client().getId(), BigDecimal.ZERO))).toList())
                .toList();
    }

    /** Sets of two or more clients with a common number; the same set is listed once. */
    private List<Set<Client>> groupsByPhone() {
        Map<String, Set<Client>> byPhone = new LinkedHashMap<>();
        for (Client c : clients.findAll()) {
            for (String phone : Phones.split(c.getPhone())) {
                byPhone.computeIfAbsent(Phones.key(phone), k -> new LinkedHashSet<>()).add(c);
            }
        }
        List<Set<Client>> groups = new ArrayList<>();
        Set<Set<Long>> seen = new LinkedHashSet<>();
        for (Set<Client> group : byPhone.values()) {
            if (group.size() < 2) continue;
            Set<Long> ids = new TreeSet<>();
            group.forEach(c -> ids.add(c.getId()));
            if (seen.add(ids)) groups.add(group); // same clients share several numbers
        }
        return groups;
    }

    /** Both clients, primary first. */
    private List<Side> order(Long a, Long b) {
        if (Objects.equals(a, b)) {
            throw new BadRequestException("error.merge.sameClient");
        }
        return List.of(side(a), side(b)).stream().sorted(PRIMARY_FIRST).toList();
    }

    private Side side(Long id) {
        Client c = clients.findById(id).orElseThrow(() -> new NotFoundException("error.client.notFound"));
        return side(c, balances.stats(id));
    }

    private static Side side(Client c, Stats s) {
        return new Side(c, s.invoiceCount(), s.lastInvoiceAt());
    }

    private MergeSide toDto(Side s) {
        return toDto(s, balances.debt(s.client().getId()));
    }

    private MergeSide toDto(Side s, BigDecimal debt) {
        return new MergeSide(mapper.toDto(s.client(), debt), s.invoiceCount(), s.lastInvoiceAt());
    }

    private static boolean blank(String v) {
        return v == null || v.isBlank();
    }
}
