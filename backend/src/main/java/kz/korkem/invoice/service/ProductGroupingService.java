package kz.korkem.invoice.service;

import kz.korkem.invoice.dto.ProductDtos.GroupMember;
import kz.korkem.invoice.dto.ProductDtos.GroupSuggestion;
import kz.korkem.invoice.dto.ProductDtos.GroupMemberRequest;
import kz.korkem.invoice.dto.ProductDtos.GroupResult;
import kz.korkem.invoice.mapper.ProductMapper;
import kz.korkem.invoice.repository.InvoiceLineRepository;
import kz.korkem.invoice.entities.Product;
import kz.korkem.invoice.entities.ProductVariant;
import kz.korkem.invoice.enums.PackUnit;
import kz.korkem.invoice.exception.BadRequestException;
import kz.korkem.invoice.exception.NotFoundException;
import kz.korkem.invoice.repository.ProductRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;
import java.util.regex.Pattern;

/**
 * Turns families of near-identical products (same price, category and pack, names differing only by
 * color) into one product with colors. Suggestions are a starting point; a person confirms each group.
 */
@Service
@RequiredArgsConstructor
public class ProductGroupingService {

    private static final Pattern SIZE = Pattern.compile("(?iu)(\\d+(?:[.,]\\d+)?)\\s*(кг|kg|гр|г|g|мл|ml|л|l)(?![\\p{L}])");

    private final ProductRepository products;
    private final InvoiceLineRepository invoiceLines;
    private final ProductMapper mapper;

    @Transactional(readOnly = true)
    public List<GroupSuggestion> suggestions() {
        Map<Long, Long> lines = new HashMap<>();
        invoiceLines.countByProduct().forEach(r -> lines.put(((Number) r[0]).longValue(), ((Number) r[1]).longValue()));

        // 1. Same category, price and pack size
        Map<List<Object>, List<Product>> byKey = new LinkedHashMap<>();
        for (Product p : products.findAll()) {
            if (p.hasVariants()) continue;
            List<Object> key = new ArrayList<>();
            key.add(p.getCategory() == null ? null : p.getCategory().getId());
            key.add(p.getPrice().stripTrailingZeros());
            key.add(p.getPackAmount() == null ? null : p.getPackAmount().stripTrailingZeros());
            key.add(p.getPackUnit());
            byKey.computeIfAbsent(key, k -> new ArrayList<>()).add(p);
        }

        List<GroupSuggestion> result = new ArrayList<>();
        for (List<Product> group : byKey.values()) {
            if (group.size() < 2) continue;
            for (List<Product> cluster : clusters(group)) {
                GroupSuggestion s = suggest(cluster, lines);
                if (s != null) result.add(s);
            }
        }
        result.sort(Comparator.comparing((GroupSuggestion s) -> s.members().size()).reversed()
                .thenComparing(GroupSuggestion::name));
        return result;
    }

    /**
     * 2. Within a price group, the same first word; split further by the second word when it names a line (ГФ-021 / ПФ-115).
     */
    public static List<List<Product>> clusters(List<Product> group) {
        Map<String, List<Product>> byFirst = new LinkedHashMap<>();
        for (Product p : group) {
            List<String> t = tokens(p.getName());
            if (t.isEmpty()) continue;
            byFirst.computeIfAbsent(t.getFirst().toLowerCase(), k -> new ArrayList<>()).add(p);
        }
        List<List<Product>> out = new ArrayList<>();
        for (List<Product> first : byFirst.values()) {
            if (first.size() < 2) continue;
            Map<String, List<Product>> bySecond = new LinkedHashMap<>();
            for (Product p : first) {
                List<String> t = tokens(p.getName());
                bySecond.computeIfAbsent(t.size() > 1 ? t.get(1).toLowerCase() : "", k -> new ArrayList<>()).add(p);
            }
            boolean numeric = bySecond.keySet().stream().anyMatch(k -> k.isEmpty() || Character.isDigit(k.charAt(0)) || k.startsWith("№"));
            // A few distinct second words (ГФ-021 / ПФ-115) name product lines; many distinct ones are colours
            boolean productLines = !numeric && bySecond.size() > 1 && bySecond.size() <= Math.max(2, first.size() / 3);
            if (productLines) {
                // Lines with a single product stay as they are
                bySecond.values().stream().filter(l -> l.size() >= 2).forEach(out::add);
            } else {
                out.add(first);
            }
        }
        return out;
    }

    /**
     * 3. Common leading words become the product name; the rest of each name becomes its colour.
     */
    private static GroupSuggestion suggest(List<Product> cluster, Map<Long, Long> lines) {
        List<List<String>> all = cluster.stream().map(p -> tokens(p.getName())).toList();
        int prefix = 0;
        outer:
        while (true) {
            for (List<String> t : all) {
                if (t.size() <= prefix || !t.get(prefix).equalsIgnoreCase(all.get(0).get(prefix))) break outer;
            }
            prefix++;
        }
        if (prefix == 0) return null;
        Product first = cluster.get(0);
        String name = String.join(" ", all.get(0).subList(0, prefix)) + packText(first);
        List<GroupMember> members = new ArrayList<>();
        for (int i = 0; i < cluster.size(); i++) {
            Product p = cluster.get(i);
            List<String> t = all.get(i);
            String variant = String.join(" ", t.subList(prefix, t.size())).trim();
            members.add(new GroupMember(p.getId(), p.getName(), variant, p.getPrice(), lines.getOrDefault(p.getId(), 0L)));
        }
        boolean duplicates = members.stream().allMatch(m -> m.variantName().isEmpty());
        if (!duplicates && members.stream().anyMatch(m -> m.variantName().isEmpty())) {
            // One name is the bare stem ("СТАТУС ПФ-115"): show it in full rather than as a blank colour
            members.replaceAll(m -> m.variantName().isEmpty()
                    ? new GroupMember(m.productId(), m.name(), m.name(), m.price(), m.invoiceLines()) : m);
        }
        members.sort(Comparator.comparing(GroupMember::variantName, String.CASE_INSENSITIVE_ORDER));
        var c = first.getCategory();
        return new GroupSuggestion(name, c == null ? null : c.getId(), c == null ? null : c.getName(), first.getPrice(),
                first.getPackAmount(), first.getPackUnit(), duplicates, members);
    }

    /**
     * Words of a name without the pack size, asterisks and brackets; "ПФ - 115" → "ПФ-115", "№ 1" → "№1".
     */
    public static List<String> tokens(String name) {
        String s = SIZE.matcher(name).replaceAll(" ")
                .replaceAll("[*()\"«»]", " ")
                .replaceAll("(?<=\\S)\\s*-\\s*(?=\\S)", "-")
                .replaceAll("№\\s*", "№")
                .replaceAll("[,.]\\s*$", "")
                .trim();
        List<String> out = new ArrayList<>();
        for (String t : s.split("\\s+")) {
            if (!t.isEmpty() && !t.equals("-")) out.add(t);
        }
        return out;
    }

    private static String packText(Product p) {
        if (p.getPackAmount() == null || p.getPackUnit() == null) return "";
        BigDecimal a = p.getPackAmount();
        boolean small = a.compareTo(BigDecimal.ONE) < 0;
        BigDecimal shown = small ? a.multiply(BigDecimal.valueOf(1000)) : a;
        String unit = p.getPackUnit() == PackUnit.KG ? (small ? "г" : "кг") : (small ? "мл" : "л");
        return " " + shown.setScale(3, RoundingMode.HALF_UP).stripTrailingZeros().toPlainString().replace('.', ',') + " " + unit;
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
