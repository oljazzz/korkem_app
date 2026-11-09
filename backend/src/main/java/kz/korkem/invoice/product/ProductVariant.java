package kz.korkem.invoice.product;

import jakarta.persistence.*;
import java.math.BigDecimal;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** One colour/shade of a product. */
@Entity
@Table(name = "product_variant")
@Getter
@Setter
@NoArgsConstructor
public class ProductVariant {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Setter(lombok.AccessLevel.NONE)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "product_id")
    private Product product;

    @Column(nullable = false)
    private String name;

    /** Own price; null means the product price. */
    private BigDecimal price;

    @Column(nullable = false)
    private boolean active = true;

    private Integer sortOrder;

    public BigDecimal effectivePrice() {
        return price != null ? price : product.getPrice();
    }
}
