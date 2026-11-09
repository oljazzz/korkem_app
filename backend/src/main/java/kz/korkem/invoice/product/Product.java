package kz.korkem.invoice.product;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import org.hibernate.annotations.BatchSize;
import kz.korkem.invoice.category.Category;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "product")
@Getter
@Setter
@NoArgsConstructor
public class Product {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Setter(lombok.AccessLevel.NONE)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "category_id")
    private Category category;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private BigDecimal price;

    private Integer sortOrder;

    /** How much one unit holds, in {@link #packUnit}; null when unknown. */
    private BigDecimal packAmount;

    @Enumerated(EnumType.STRING)
    private PackUnit packUnit;

    /** Colours/shades; empty for a product sold without variants. */
    @OneToMany(mappedBy = "product", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("sortOrder ASC, id ASC")
    @BatchSize(size = 100)
    @Setter(lombok.AccessLevel.NONE)
    private List<ProductVariant> variants = new ArrayList<>();

    public boolean hasVariants() {
        return !variants.isEmpty();
    }
}
