package kz.korkem.invoice.mapper;

import kz.korkem.invoice.dto.ProductDtos.ProductDto;
import kz.korkem.invoice.dto.ProductDtos.ProductOption;
import kz.korkem.invoice.dto.ProductDtos.VariantDto;
import kz.korkem.invoice.entities.Category;
import kz.korkem.invoice.entities.Product;
import kz.korkem.invoice.entities.ProductVariant;
import kz.korkem.invoice.util.Snapshot;
import org.springframework.stereotype.Component;

@Component
public class ProductMapper {

    public ProductDto toDto(Product p) {
        Category c = p.getCategory();
        return new ProductDto(p.getId(), c == null ? null : c.getId(), c == null ? null : c.getName(),
                p.getName(), p.getPrice(), p.getSortOrder(), p.getPackAmount(), p.getPackUnit(),
                p.getVariants().stream().map(this::toDto).toList());
    }

    public VariantDto toDto(ProductVariant v) {
        return new VariantDto(v.getId(), v.getName(), v.getPrice(), v.isActive(), v.getSortOrder());
    }

    /** The product itself ({@code variant} null) or one of its colours, as an invoice line choice. */
    public ProductOption toOption(Product p, ProductVariant variant) {
        Category c = p.getCategory();
        return new ProductOption(p.getId(), variant == null ? null : variant.getId(), p.lineName(variant), p.getName(),
                variant == null ? null : variant.getName(), variant == null ? p.getPrice() : variant.effectivePrice(),
                p.getPackAmount(), p.getPackUnit(), c == null ? null : c.getId(), c == null ? null : c.getName());
    }

    /** Sort order is left out: reordering the price list is not a change worth logging. */
    public Snapshot audit(Product p) {
        Category c = p.getCategory();
        return Snapshot.of()
                .put("name", p.getName())
                .put("category", c == null ? null : c.getName())
                .put("price", p.getPrice())
                .put("pack", p.getPackAmount() == null ? null
                        : p.getPackAmount().stripTrailingZeros().toPlainString() + " " + p.getPackUnit())
                .put("variants", p.getVariants().stream().map(ProductMapper::auditVariant).toList());
    }

    /** "ақ", "ақ — 2900", "ақ (өшірулі)" */
    private static String auditVariant(ProductVariant v) {
        String price = v.getPrice() == null ? "" : " — " + v.getPrice().stripTrailingZeros().toPlainString();
        return v.getName() + price + (v.isActive() ? "" : " (өшірулі)");
    }
}
