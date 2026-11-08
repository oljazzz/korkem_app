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

    @Transactional(readOnly = true)
    /**
     * Invoice list. A purely numeric query searches by invoice number; [from, to] are calendar days
     * in the Almaty time zone, both inclusive and optional.
     */
    public PageResponse<InvoiceListItem> list(String q, Long clientId, LocalDate from,
                                              LocalDate to, int page, int size) {
        ZoneId zone = ZoneId.of("Asia/Almaty");
        Instant fromTs = from == null ? null : from.atStartOfDay(zone).toInstant();
        Instant toTs = to == null ? null : to.plusDays(1).atStartOfDay(zone).toInstant();
        String query = q == null ? "" : q.trim();
        Long number = null;
        String digits = query.replaceAll("\\s", "");
        if (!digits.isEmpty() && digits.chars().allMatch(Character::isDigit) && digits.length() < 18) {
            number = Long.parseLong(digits);
            query = "";
        }
        var result = invoices.search(number, query, clientId, fromTs, toTs,
                PageRequest.of(page, PageResponse.clampSize(size), Sort.by(Sort.Direction.DESC, "number")));
        Map<Long, BigDecimal> totals = new HashMap<>();
        if (!result.isEmpty()) {
            invoices.totalsFor(result.map(Invoice::getId).getContent())
                    .forEach(r -> totals.put((Long) r[0], (BigDecimal) r[1]));
        }
        return PageResponse.of(result, i -> new InvoiceListItem(i.getId(), i.getNumber(),
                i.getClient() == null ? null : i.getClient().getId(),
                i.getClient() == null ? null : i.getClient().getDisplayName(), i.getCreatedAt(),
                totals.getOrDefault(i.getId(), BigDecimal.ZERO)));
    }

    @Transactional(readOnly = true)
    public InvoiceDto get(Long id) {
        return toDto(find(id));
    }

    @Transactional
    public InvoiceDto create(InvoiceRequest req, String username) {
        Invoice inv = new Invoice();
        inv.setNumber(invoices.nextNumber());
        inv.setCreatedAt(Instant.now());
        inv.setCreatedBy(username);
        apply(inv, req);
        return toDto(invoices.save(inv));
    }

    @Transactional
    public InvoiceDto update(Long id, InvoiceRequest req) {
        Invoice inv = find(id);
        apply(inv, req);
        invoices.flush();
        return toDto(inv);
    }

    @Transactional
    public void delete(Long id) {
        invoices.delete(find(id));
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
        return new InvoiceDto(inv.getId(), inv.getNumber(), c == null ? null : c.getId(),
                c == null ? null : c.getDisplayName(), inv.getCreatedAt(), inv.getCreatedBy(), lines, total, vat);
    }
}
