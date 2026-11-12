package kz.korkem.invoice.repository;

import java.util.List;
import kz.korkem.invoice.entities.InvoiceLine;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** Invoice lines; used directly only when products are merged (lines follow their product). */
public interface InvoiceLineRepository extends JpaRepository<InvoiceLine, Long> {

    /** [productId, number of invoice lines] for every product that has been sold. */
    @Query(value = "select product_id, count(*) from invoice_line where product_id is not null group by product_id",
            nativeQuery = true)
    List<Object[]> countByProduct();

    /** Moves lines of one product to another; returns how many moved. */
    @Modifying
    @Query(value = "update invoice_line set product_id = :toId where product_id = :fromId", nativeQuery = true)
    int moveProduct(@Param("fromId") Long fromId, @Param("toId") Long toId);

    /** Moves lines of one product to a colour of another product; returns how many moved. */
    @Modifying
    @Query(value = "update invoice_line set product_id = :toId, variant_id = :variantId where product_id = :fromId",
            nativeQuery = true)
    int moveProductToColour(@Param("fromId") Long fromId, @Param("toId") Long toId, @Param("variantId") Long variantId);
}
