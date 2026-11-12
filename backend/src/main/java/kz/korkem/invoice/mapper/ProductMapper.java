package kz.korkem.invoice.mapper;

import kz.korkem.invoice.dto.ProductDtos.ProductDto;
import kz.korkem.invoice.dto.ProductDtos.ProductOption;
import kz.korkem.invoice.dto.ProductDtos.VariantDto;
import kz.korkem.invoice.entities.Category;
import kz.korkem.invoice.entities.Product;
import kz.korkem.invoice.entities.ProductVariant;
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
}
