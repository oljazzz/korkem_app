package kz.korkem.invoice.service;

import static kz.korkem.invoice.constants.DateProps.ZONE;
import static kz.korkem.invoice.constants.DateProps.endOf;
import static kz.korkem.invoice.constants.DateProps.startOf;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import kz.korkem.invoice.domain.InvoiceBalance;
import kz.korkem.invoice.dto.InvoiceDtos.InvoiceDto;
import kz.korkem.invoice.dto.InvoiceDtos.InvoiceListItem;
import kz.korkem.invoice.dto.InvoiceDtos.InvoiceRequest;
import kz.korkem.invoice.dto.InvoiceDtos.InvoiceSummary;
import kz.korkem.invoice.dto.PageResponse;
import kz.korkem.invoice.entities.Invoice;
import kz.korkem.invoice.exception.BadRequestException;
import kz.korkem.invoice.exception.NotFoundException;
import kz.korkem.invoice.mapper.InvoiceMapper;
import kz.korkem.invoice.repository.ClientRepository;
import kz.korkem.invoice.repository.InvoiceRepository;
import kz.korkem.invoice.repository.PaymentRepository;
import kz.korkem.invoice.repository.query.InvoiceSummaryQuery;
import kz.korkem.invoice.util.InvoiceSearch;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Invoices: search, totals, and writing them. Lines are built by {@link InvoiceLineFactory}. */
@Service
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class InvoiceService {

    private final InvoiceRepository invoices;
    private final ClientRepository clients;
    private final PaymentRepository payments;
    private final InvoiceSummaryQuery summaries;
    private final InvoiceLineFactory lineFactory;
    private final InvoiceMapper mapper;
    private final Clock clock;

    /**
     * Invoice list. A purely numeric query searches by invoice number; [from, to] are calendar days
     * in the Almaty time zone, both inclusive and optional. {@code dueOnly} keeps invoices with money still owed.
     */
    public PageResponse<InvoiceListItem> list(String q, Long clientId, LocalDate from,
                                              LocalDate to, boolean dueOnly, int page, int size) {
        InvoiceSearch s = InvoiceSearch.of(q);
        var result = invoices.search(s.number(), s.text(), clientId, startOf(from), endOf(to), dueOnly,
                PageRequest.of(page, PageResponse.clampSize(size), Sort.by(Sort.Direction.DESC, "number")));
        Map<Long, BigDecimal> totals = new HashMap<>();
        Map<Long, BigDecimal> paid = new HashMap<>();
        if (!result.isEmpty()) {
            var ids = result.map(Invoice::getId).getContent();
            invoices.totalsFor(ids).forEach(r -> totals.put((Long) r[0], (BigDecimal) r[1]));
            payments.paidFor(ids).forEach(r -> paid.put((Long) r[0], (BigDecimal) r[1]));
        }
        return PageResponse.of(result, i -> mapper.toListItem(i, new InvoiceBalance(
                totals.getOrDefault(i.getId(), BigDecimal.ZERO), paid.getOrDefault(i.getId(), BigDecimal.ZERO),
                i.isLegacyPaid())));
    }

    /** Count, amount and amount still owed over all invoices matching the list filters. */
    public InvoiceSummary summary(String q, Long clientId, LocalDate from, LocalDate to, boolean dueOnly) {
        InvoiceSearch s = InvoiceSearch.of(q);
        return summaries.summary(s.number(), s.text(), clientId, startOf(from), endOf(to), dueOnly);
    }

    /** The client's latest invoices, newest first. */
    public List<InvoiceListItem> recentForClient(Long clientId, int limit) {
        return list("", clientId, null, null, false, 0, limit).items();
    }

    /** The client's most recent invoice, used to repeat an order. */
    public InvoiceDto lastForClient(Long clientId) {
        return invoices.findFirstByClientIdOrderByCreatedAtDescIdDesc(clientId)
                .map(i -> toDto(find(i.getId())))
                .orElseThrow(() -> new NotFoundException("error.client.noInvoices"));
    }

    public InvoiceDto get(Long id) {
        return toDto(find(id));
    }

    @Transactional
    public InvoiceDto create(InvoiceRequest req, String username) {
        Invoice inv = new Invoice();
        inv.setNumber(invoices.nextNumber());
        inv.setCreatedAt(documentTime(req.date()));
        inv.setCreatedBy(username);
        apply(inv, req);
        return toDto(invoices.save(inv));
    }

    @Transactional
    public InvoiceDto update(Long id, InvoiceRequest req) {
        Invoice inv = find(id);
        if (req.date() != null && !req.date().equals(LocalDate.ofInstant(inv.getCreatedAt(), ZONE))) {
            inv.setCreatedAt(documentTime(req.date()));
        }
        apply(inv, req);
        BigDecimal paid = payments.paidFor(id);
        if (!InvoiceBalance.of(inv, paid).coversPaid()) {
            throw new BadRequestException("error.invoice.belowPaid", paid.toPlainString());
        }
        invoices.flush();
        return mapper.toDto(inv, paid);
    }

    @Transactional
    public void delete(Long id) {
        if (payments.existsByInvoiceId(id)) {
            throw new BadRequestException("error.invoice.hasPayments");
        }
        invoices.delete(find(id));
    }

    /** Today (or no date) → now; a past day → noon of that day in Almaty, so it never shifts across midnight. */
    private Instant documentTime(LocalDate date) {
        Instant now = clock.instant();
        LocalDate today = LocalDate.ofInstant(now, ZONE);
        if (date == null || date.equals(today)) {
            return now;
        }
        if (date.isAfter(today)) {
            throw new BadRequestException("error.invoice.futureDate");
        }
        return date.atTime(12, 0).atZone(ZONE).toInstant();
    }

    private void apply(Invoice inv, InvoiceRequest req) {
        inv.setClient(req.clientId() == null ? null : clients.findById(req.clientId())
                .orElseThrow(() -> new NotFoundException("error.client.notFound")));
        inv.replaceLines(lineFactory.build(req.lines()));
    }

    private Invoice find(Long id) {
        return invoices.findWithLines(id).orElseThrow(() -> new NotFoundException("error.invoice.notFound"));
    }

    private InvoiceDto toDto(Invoice inv) {
        return mapper.toDto(inv, inv.getId() == null ? BigDecimal.ZERO : payments.paidFor(inv.getId()));
    }
}
