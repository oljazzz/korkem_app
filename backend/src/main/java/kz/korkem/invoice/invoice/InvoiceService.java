package kz.korkem.invoice.invoice;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import kz.korkem.invoice.category.Category;
import kz.korkem.invoice.category.CategoryRepository;
import kz.korkem.invoice.client.ClientRepository;
import kz.korkem.invoice.common.BadRequestException;
import kz.korkem.invoice.common.NotFoundException;
import kz.korkem.invoice.common.PageResponse;
import kz.korkem.invoice.invoice.InvoiceDtos.*;
import kz.korkem.invoice.payment.PaymentRepository;
import kz.korkem.invoice.product.Product;
import kz.korkem.invoice.product.ProductRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class InvoiceService {

    private final InvoiceRepository invoices;
    private final ClientRepository clients;
    private final ProductRepository products;
    private final CategoryRepository categories;
    private final InvoiceCalculator calculator;
    private final PaymentRepository payments;
    private final InvoiceStats stats;

    private static final ZoneId ZONE = ZoneId.of("Asia/Almaty");

    @Transactional(readOnly = true)
    /**
     * Invoice list. A purely numeric query searches by invoice number; [from, to] are calendar days
     * in the Almaty time zone, both inclusive and optional. {@code dueOnly} keeps invoices with money still owed.
     */
    public PageResponse<InvoiceListItem> list(String q, Long clientId, LocalDate from,
                                              LocalDate to, boolean dueOnly, int page, int size) {
        Instant fromTs = from == null ? null : from.atStartOfDay(ZONE).toInstant();
        Instant toTs = to == null ? null : to.plusDays(1).atStartOfDay(ZONE).toInstant();
        String query = q == null ? "" : q.trim();
        Long number = null;
        String digits = query.replaceAll("\\s", "");
        if (!digits.isEmpty() && digits.chars().allMatch(Character::isDigit) && digits.length() < 18) {
            number = Long.parseLong(digits);
            query = "";
        }
        var result = invoices.search(number, query, clientId, fromTs, toTs, dueOnly,
                PageRequest.of(page, PageResponse.clampSize(size), Sort.by(Sort.Direction.DESC, "number")));
        Map<Long, BigDecimal> totals = new HashMap<>();
        Map<Long, BigDecimal> paid = new HashMap<>();
        if (!result.isEmpty()) {
            var ids = result.map(Invoice::getId).getContent();
            invoices.totalsFor(ids).forEach(r -> totals.put((Long) r[0], (BigDecimal) r[1]));
            payments.paidFor(ids).forEach(r -> paid.put((Long) r[0], (BigDecimal) r[1]));
        }
        return PageResponse.of(result, i -> {
            BigDecimal total = totals.getOrDefault(i.getId(), BigDecimal.ZERO);
            BigDecimal p = paid.getOrDefault(i.getId(), BigDecimal.ZERO);
            var c = i.getClient();
            return new InvoiceListItem(i.getId(), i.getNumber(), c == null ? null : c.getId(),
                    c == null ? null : c.getLabel(), c == null ? null : c.getPlace(), i.getCreatedAt(), total,
                    p, PaymentStatus.due(total, p, i.isLegacyPaid()), PaymentStatus.of(total, p, i.isLegacyPaid()));
        });
    }

    /** Count, amount and amount still owed over all invoices matching the list filters. */
    @Transactional(readOnly = true)
    public InvoiceSummary summary(String q, Long clientId, LocalDate from, LocalDate to, boolean dueOnly) {
        String query = q == null ? "" : q.trim();
        Long number = null;
        String digits = query.replaceAll("\\s", "");
        if (!digits.isEmpty() && digits.chars().allMatch(Character::isDigit) && digits.length() < 18) {
            number = Long.parseLong(digits);
            query = "";
        }
        return stats.summary(number, query, clientId,
                from == null ? null : from.atStartOfDay(ZONE).toInstant(),
                to == null ? null : to.plusDays(1).atStartOfDay(ZONE).toInstant(), dueOnly);
    }

    /** The client's most recent invoice, used to repeat an order. */
    @Transactional(readOnly = true)
    public InvoiceDto lastForClient(Long clientId) {
        return invoices.findFirstByClientIdOrderByCreatedAtDescIdDesc(clientId)
                .map(i -> toDto(find(i.getId())))
                .orElseThrow(() -> new NotFoundException("Клиенттің жүкқұжаттары жоқ"));
    }

    @Transactional(readOnly = true)
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
        BigDecimal total = inv.getLines().stream().map(InvoiceLine::getTotal).reduce(BigDecimal.ZERO, BigDecimal::add);
        if (total.compareTo(paid) < 0) {
            throw new BadRequestException("Жүкқұжат сомасы төленген сомадан (" + paid.toPlainString() + " ₸) аз болмауы керек");
        }
        invoices.flush();
        return toDto(inv);
    }

    @Transactional
    public void delete(Long id) {
        if (payments.existsByInvoiceId(id)) {
            throw new BadRequestException("Төлемдері бар жүкқұжатты жоюға болмайды: алдымен төлемдерді жойыңыз");
        }
        invoices.delete(find(id));
    }

    /** Today (or no date) → now; a past day → noon of that day in Almaty, so it never shifts across midnight. */
    private static Instant documentTime(LocalDate date) {
        LocalDate today = LocalDate.now(ZONE);
        if (date == null || date.equals(today)) {
            return Instant.now();
        }
        if (date.isAfter(today)) {
            throw new BadRequestException("Жүкқұжат күні болашақта болмауы керек");
        }
        return date.atTime(12, 0).atZone(ZONE).toInstant();
    }

    private void apply(Invoice inv, InvoiceRequest req) {
        inv.setClient(req.clientId() == null ? null : clients.findById(req.clientId())
                .orElseThrow(() -> new NotFoundException("Клиент табылмады")));

        List<InvoiceLine> lines = new ArrayList<>();
        int index = 0;
        for (LineRequest lr : req.lines()) {
            index++;
            InvoiceLine line = new InvoiceLine();
            Product product = lr.productId() == null ? null : products.findById(lr.productId())
                    .orElseThrow(() -> new NotFoundException("Тауар табылмады"));
            Category category = lr.categoryId() != null
                    ? categories.findById(lr.categoryId()).orElse(null)
                    : product != null ? product.getCategory() : null;

            String name = product != null ? product.getName()
                    : lr.productName() == null ? "" : lr.productName().trim();
            if (name.isEmpty()) {
                throw new BadRequestException(index + "-жолда тауар таңдалмаған");
            }

            line.setProduct(product);
            line.setCategory(category);
            line.setProductName(name);
            line.setUnit(lr.unit() == null ? Unit.SHT : lr.unit());
            line.setPrice(lr.price());
            line.setQuantity(lr.quantity());
            line.setDiscount(lr.discount());
            line.setSortOrder(lr.sortOrder() == null ? index : lr.sortOrder());
            line.setTotal(calculator.total(lr.price(), lr.quantity(), lr.discount()));
            line.setVat(calculator.vat(line.getTotal()));
            lines.add(line);
        }
        inv.replaceLines(lines);
    }

    private Invoice find(Long id) {
        return invoices.findWithLines(id).orElseThrow(() -> new NotFoundException("Жүкқұжат табылмады"));
    }

    private InvoiceDto toDto(Invoice inv) {
        List<LineDto> lines = inv.getLines().stream().map(l -> new LineDto(
                l.getId(),
                l.getCategory() == null ? null : l.getCategory().getId(),
                l.getCategory() == null ? null : l.getCategory().getName(),
                l.getProduct() == null ? null : l.getProduct().getId(),
                l.getProductName(), l.getUnit(), l.getUnit().getLabel(), l.getPrice(), l.getQuantity(),
                l.getDiscount(), l.getTotal(), l.getVat(), l.getSortOrder())).toList();
        BigDecimal total = lines.stream().map(LineDto::total).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal vat = lines.stream().map(LineDto::vat).reduce(BigDecimal.ZERO, BigDecimal::add);
        var c = inv.getClient();
        BigDecimal paid = inv.getId() == null ? BigDecimal.ZERO : payments.paidFor(inv.getId());
        boolean legacy = inv.isLegacyPaid();
        return new InvoiceDto(inv.getId(), inv.getNumber(), c == null ? null : c.getId(),
                c == null ? null : c.getDisplayName(), c == null ? null : c.getLabel(), inv.getCreatedAt(), inv.getCreatedBy(), lines, total, vat,
                paid, PaymentStatus.due(total, paid, legacy), PaymentStatus.of(total, paid, legacy), legacy);
    }
}
