package kz.korkem.invoice.service;

import kz.korkem.invoice.dto.ProductDtos.GroupSuggestion;
import kz.korkem.invoice.dto.ProductDtos.GroupMemberRequest;
import kz.korkem.invoice.dto.ProductDtos.GroupResult;
import kz.korkem.invoice.mapper.ProductMapper;
import kz.korkem.invoice.repository.InvoiceLineRepository;
import kz.korkem.invoice.entities.Product;
import kz.korkem.invoice.entities.ProductVariant;
import kz.korkem.invoice.exception.BadRequestException;
import kz.korkem.invoice.exception.NotFoundException;
import kz.korkem.invoice.repository.ProductRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

/**
 * Turns a family of near-identical products into one product with colours: invoice lines move to it
 * and the other products are deleted. Which families to offer is {@link ProductGroupingSuggester}'s job.
 */
@Service
@RequiredArgsConstructor
public class ProductGroupingService {

    private final ProductRepository products;
    private final InvoiceLineRepository invoiceLines;
    private final ProductMapper mapper;
    private final ProductGroupingSuggester suggester;

    /** Families that look like one product in several colours; a person confirms each one. */
    @Transactional(readOnly = true)
    public List<GroupSuggestion> suggestions() {
        Map<Long, Long> lines = new HashMap<>();
        invoiceLines.countByProduct().forEach(r -> lines.put(((Number) r[0]).longValue(), ((Number) r[1]).longValue()));
        return suggester.suggest(products.findAll(), lines);
    }

    /**
     * Merges the given products into the first one: it is renamed, gets one colour per product,
     * invoice lines move to it with their colour, and the other products are deleted.
     */
    @Transactional
    public GroupResult group(String name, List<GroupMemberRequest> members) {
        if (name == null || name.isBlank()) throw new BadRequestException("validation.product.name.required");
        if (members == null || members.size() < 2) throw new BadRequestException("error.grouping.twoProducts");
        Set<Long> ids = new LinkedHashSet<>();
        members.forEach(m -> {
            if (m.productId() == null || !ids.add(m.productId()))
                throw new BadRequestException("error.grouping.duplicateProduct");
        });
        // All colours blank = the same product entered several times: merge without colours
        boolean plainMerge = members.stream().allMatch(m -> m.variantName() == null || m.variantName().isBlank());
        if (!plainMerge && members.stream().anyMatch(m -> m.variantName() == null || m.variantName().isBlank())) {
            throw new BadRequestException("error.grouping.colourNames");
        }
        Map<Long, Product> byId = new HashMap<>();
        products.findAllById(ids).forEach(p -> byId.put(p.getId(), p));
        for (Long id : ids) {
            Product p = byId.get(id);
            if (p == null) throw new NotFoundException("error.product.notFound");
            if (p.hasVariants()) throw new BadRequestException("error.grouping.hasColours", p.getName());
        }

        Product base = byId.get(members.get(0).productId());
        base.setName(name.trim());
        if (plainMerge) {
            int moved = 0;
            for (Long id : ids) {
                if (Objects.equals(id, base.getId())) continue;
                moved += invoiceLines.moveProduct(id, base.getId());
                products.delete(byId.get(id));
            }
            products.flush();
            return new GroupResult(mapper.toDto(base), 0, ids.size() - 1, moved);
        }
        // One colour per distinct name; the same colour written twice becomes one
        Map<String, ProductVariant> variantsByName = new LinkedHashMap<>();
        Map<Long, ProductVariant> variantOf = new HashMap<>();
        int order = 0;
        for (GroupMemberRequest m : members) {
            Product p = byId.get(m.productId());
            String vName = m.variantName().trim();
            ProductVariant v = variantsByName.get(vName.toLowerCase());
            if (v == null) {
                v = new ProductVariant();
                v.setProduct(base);
                v.setName(vName);
                v.setPrice(p.getPrice().compareTo(base.getPrice()) == 0 ? null : p.getPrice());
                v.setSortOrder(++order);
                base.getVariants().add(v);
                variantsByName.put(vName.toLowerCase(), v);
            }
            variantOf.put(p.getId(), v);
        }
        // base is managed: flushing cascades the new colours and gives them ids
        // (save() would merge and create copies, leaving these instances without ids)
        products.flush();

        int moved = 0;
        for (Long id : ids) {
            moved += invoiceLines.moveProductToColour(id, base.getId(), variantOf.get(id).getId());
        }
        int removed = 0;
        for (Long id : ids) {
            if (!Objects.equals(id, base.getId())) {
                products.delete(byId.get(id));
                removed++;
            }
        }
        products.flush();
        return new GroupResult(mapper.toDto(base), variantsByName.size(), removed, moved);
    }
}
