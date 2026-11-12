package kz.korkem.invoice.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;
import kz.korkem.invoice.dto.ProductDtos.GroupMember;
import kz.korkem.invoice.dto.ProductDtos.GroupSuggestion;
import kz.korkem.invoice.entities.Product;
import kz.korkem.invoice.enums.PackUnit;
import org.springframework.stereotype.Component;

/**
 * Finds families of near-identical products: same price, category and pack, names differing only by
 * colour. Pure text work, no database; suggestions are a starting point that a person confirms.
 */
@Component
public class ProductGroupingSuggester {

    private static final Pattern SIZE = Pattern.compile("(?iu)(\\d+(?:[.,]\\d+)?)\\s*(кг|kg|гр|г|g|мл|ml|л|l)(?![\\p{L}])");

    /** {@code lines}: invoice lines per product id, shown so the user sees which products are in use. */
    public List<GroupSuggestion> suggest(Collection<Product> products, Map<Long, Long> lines) {
        // 1. Same category, price and pack size
        Map<List<Object>, List<Product>> byKey = new LinkedHashMap<>();
        for (Product p : products) {
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
    static List<List<Product>> clusters(List<Product> group) {
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
    static List<String> tokens(String name) {
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
}
