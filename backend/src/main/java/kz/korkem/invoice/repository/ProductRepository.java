package kz.korkem.invoice.repository;

import kz.korkem.invoice.entities.Product;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ProductRepository extends JpaRepository<Product, Long> {

    @EntityGraph(attributePaths = "category")
    @Query("""
            select p from Product p left join p.category c
            where (lower(p.name) like lower(concat('%', :q, '%'))
                   or exists (select v from ProductVariant v where v.product = p
                              and lower(v.name) like lower(concat('%', :q, '%'))))
              and (:categoryId is null or c.id = :categoryId)
            """)
    Page<Product> search(@Param("q") String q, @Param("categoryId") Long categoryId, Pageable pageable);
}
