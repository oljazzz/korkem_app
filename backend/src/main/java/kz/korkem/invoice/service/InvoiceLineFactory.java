package kz.korkem.invoice.service;

import java.util.ArrayList;
import java.util.List;
import kz.korkem.invoice.dto.InvoiceDtos.LineRequest;
import kz.korkem.invoice.entities.Category;
import kz.korkem.invoice.entities.InvoiceLine;
import kz.korkem.invoice.entities.Product;
import kz.korkem.invoice.entities.ProductVariant;
import kz.korkem.invoice.enums.Unit;
import kz.korkem.invoice.exception.BadRequestException;
import kz.korkem.invoice.exception.NotFoundException;
import kz.korkem.invoice.repository.CategoryRepository;
import kz.korkem.invoice.repository.ProductRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * Builds invoice lines from a request: resolves the product, its colour and category, names the line
 * and works out its total and VAT. Line numbers in errors are 1-based, as the user sees them.
 */
@Component
@RequiredArgsConstructor
public class InvoiceLineFactory {

    private final ProductRepository products;
    private final CategoryRepository categories;
    private final InvoiceCalculator calculator;

    public List<InvoiceLine> build(List<LineRequest> requests) {
        List<InvoiceLine> lines = new ArrayList<>();
        for (int i = 0; i < requests.size(); i++) {
            lines.add(build(requests.get(i), i + 1));
        }
        return lines;
    }

    private InvoiceLine build(LineRequest req, int lineNo) {
        Product product = req.productId() == null ? null : products.findById(req.productId())
                .orElseThrow(() -> new NotFoundException("error.product.notFound"));
        ProductVariant variant = variant(product, req.variantId(), lineNo);
        Category category = req.categoryId() != null
                ? categories.findById(req.categoryId()).orElse(null)
                : product != null ? product.getCategory() : null;

        String name = product != null ? product.lineName(variant)
                : req.productName() == null ? "" : req.productName().trim();
        if (name.isEmpty()) {
            throw new BadRequestException("error.invoice.line.productMissing", String.valueOf(lineNo));
        }

        InvoiceLine line = new InvoiceLine();
        line.setProduct(product);
        line.setVariant(variant);
        line.setCategory(category);
        line.setProductName(name);
        line.setUnit(req.unit() == null ? Unit.SHT : req.unit());
        line.setPrice(req.price());
        line.setQuantity(req.quantity());
        line.setDiscount(req.discount());
        line.setSortOrder(req.sortOrder() == null ? lineNo : req.sortOrder());
        line.setTotal(calculator.total(req.price(), req.quantity(), req.discount()));
        line.setVat(calculator.vat(line.getTotal()));
        return line;
    }

    /** The chosen colour; a product with colours must have one, and it must be that product's. */
    private static ProductVariant variant(Product product, Long variantId, int lineNo) {
        if (product == null) return null;
        if (variantId != null) {
            return product.getVariants().stream().filter(v -> v.getId().equals(variantId)).findFirst()
                    .orElseThrow(() -> new BadRequestException("error.invoice.line.colourMismatch", String.valueOf(lineNo)));
        }
        if (product.hasVariants()) {
            throw new BadRequestException("error.invoice.line.colourRequired", String.valueOf(lineNo), product.getName());
        }
        return null;
    }
}
