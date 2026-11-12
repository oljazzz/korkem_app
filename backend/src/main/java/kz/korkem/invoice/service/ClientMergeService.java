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

import kz.korkem.invoice.dto.ClientDtos.MergePlan;
import kz.korkem.invoice.dto.ClientDtos.MergeResult;
import kz.korkem.invoice.dto.ClientDtos.MergeSide;
import kz.korkem.invoice.entities.Client;
import kz.korkem.invoice.mapper.ClientMapper;
import kz.korkem.invoice.repository.query.ClientBalanceQuery;
import kz.korkem.invoice.exception.BadRequestException;
import kz.korkem.invoice.exception.NotFoundException;
import kz.korkem.invoice.repository.ClientRepository;
import kz.korkem.invoice.repository.InvoiceRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Merges duplicate client records. The client whose latest invoice is newer stays (primary);
 * the other one's invoices move to it and its record is deleted.
 */
@Service
@RequiredArgsConstructor
public class ClientMergeService {

    /** One side of a merge, with the figures that decide which one stays. */
    record Side(Client client, long invoiceCount, Instant lastInvoiceAt) {}

    private record Plan(Side primary, Side secondary) {}

    private final ClientRepository clients;
    private final ClientBalanceQuery balances;
    private final InvoiceRepository invoices;
    private final ClientMapper mapper;

    /** Primary = newer last invoice; then more invoices; then the older record. */
    static final Comparator<Side> PRIMARY_FIRST = Comparator
            .comparing(Side::lastInvoiceAt, Comparator.nullsLast(Comparator.<Instant>reverseOrder()))
            .thenComparing(Side::invoiceCount, Comparator.reverseOrder())
            .thenComparing(s -> s.client().getId());

    /** Which of the two clients would stay and which would be removed. */
    @Transactional(readOnly = true)
    public MergePlan plan(Long a, Long b) {
        Plan plan = order(a, b);
        return new MergePlan(toDto(plan.primary()), toDto(plan.secondary()));
    }

    private Plan order(Long a, Long b) {
        if (Objects.equals(a, b)) {
            throw new BadRequestException("error.merge.sameClient");
        }
        List<Side> sides = new ArrayList<>(List.of(side(a), side(b)));
        sides.sort(PRIMARY_FIRST);
        return new Plan(sides.get(0), sides.get(1));
    }

    @Transactional
    public MergeResult merge(Long a, Long b) {
        Plan plan = order(a, b);
        Client primary = plan.primary().client();
        Client secondary = plan.secondary().client();

        int moved = invoices.moveToClient(secondary.getId(), primary.getId());

        // Keep the primary's details; take the secondary's only where the primary has none
        primary.setPhone(joinPhones(primary.getPhone(), secondary.getPhone()));
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
        return duplicatesByPhone().stream().map(g -> g.stream().map(this::toDto).toList()).toList();
    }

    private List<List<Side>> duplicatesByPhone() {
        Map<String, Set<Client>> byPhone = new LinkedHashMap<>();
        for (Client c : clients.findAll()) {
            for (String phone : phones(c.getPhone())) {
                byPhone.computeIfAbsent(digits(phone), k -> new LinkedHashSet<>()).add(c);
            }
        }
        List<List<Side>> groups = new ArrayList<>();
        Set<Set<Long>> seen = new LinkedHashSet<>();
        for (Set<Client> group : byPhone.values()) {
            if (group.size() < 2) continue;
            Set<Long> ids = new java.util.TreeSet<>();
            group.forEach(c -> ids.add(c.getId()));
            if (!seen.add(ids)) continue; // same clients share several numbers
            List<Side> sides = new ArrayList<>(group.stream().map(c -> {
                var s = balances.stats(c.getId());
                return new Side(c, s.invoiceCount(), s.lastInvoiceAt());
            }).toList());
            sides.sort(PRIMARY_FIRST);
            groups.add(sides);
        }
        groups.sort(Comparator.comparing((List<Side> g) -> g.get(0).lastInvoiceAt(),
                Comparator.nullsLast(Comparator.<Instant>reverseOrder())));
        return groups;
    }

    private MergeSide toDto(Side s) {
        return new MergeSide(mapper.toDto(s.client(), balances.debt(s.client().getId())), s.invoiceCount(), s.lastInvoiceAt());
    }

    private Side side(Long id) {
        Client c = clients.findById(id).orElseThrow(() -> new NotFoundException("error.client.notFound"));
        var s = balances.stats(id);
        return new Side(c, s.invoiceCount(), s.lastInvoiceAt());
    }

    static List<String> phones(String value) {
        if (value == null) return List.of();
        return java.util.Arrays.stream(value.split(",")).map(String::trim).filter(p -> !p.isEmpty()).toList();
    }

    private static String digits(String phone) {
        String d = phone.replaceAll("\\D", "");
        return d.length() == 11 && (d.startsWith("8") || d.startsWith("7")) ? d.substring(1) : d;
    }

    /** Union of both phone lists, compared by digits, at most 100 characters. */
    static String joinPhones(String first, String second) {
        Map<String, String> all = new LinkedHashMap<>();
        for (String p : phones(first)) all.putIfAbsent(digits(p), p);
        for (String p : phones(second)) all.putIfAbsent(digits(p), p);
        String joined = String.join(", ", all.values());
        if (joined.isEmpty()) return null;
        return joined.length() > 100 ? first : joined;
    }

    private static boolean blank(String v) {
        return v == null || v.isBlank();
    }
}
