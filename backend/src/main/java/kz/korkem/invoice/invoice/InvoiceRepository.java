package kz.korkem.invoice.invoice;

import java.time.Instant;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface InvoiceRepository extends JpaRepository<Invoice, Long> {

    @EntityGraph(attributePaths = "client")
    @Query(value = """
            select i from Invoice i left join i.client c
            where (:number is null or i.number = :number)
              and (:q = '' or lower(c.name) like lower(concat('%', :q, '%'))
                           or lower(coalesce(c.address, '')) like lower(concat('%', :q, '%')))
              and (:clientId is null or c.id = :clientId)
              and (cast(:from as timestamp) is null or i.createdAt >= :from)
              and (cast(:to as timestamp) is null or i.createdAt < :to)
              and (:dueOnly = false or (i.legacyPaid = false
                   and (select coalesce(sum(l.total), 0) from InvoiceLine l where l.invoice = i)
                     > (select coalesce(sum(p.amount), 0) from Payment p where p.invoice = i)))
            """,
            countQuery = """
            select count(i) from Invoice i left join i.client c
            where (:number is null or i.number = :number)
              and (:q = '' or lower(c.name) like lower(concat('%', :q, '%'))
                           or lower(coalesce(c.address, '')) like lower(concat('%', :q, '%')))
              and (:clientId is null or c.id = :clientId)
              and (cast(:from as timestamp) is null or i.createdAt >= :from)
              and (cast(:to as timestamp) is null or i.createdAt < :to)
              and (:dueOnly = false or (i.legacyPaid = false
                   and (select coalesce(sum(l.total), 0) from InvoiceLine l where l.invoice = i)
                     > (select coalesce(sum(p.amount), 0) from Payment p where p.invoice = i)))
            """)
    Page<Invoice> search(@Param("number") Long number, @Param("q") String q,
                         @Param("clientId") Long clientId, @Param("from") Instant from,
                         @Param("to") Instant to, @Param("dueOnly") boolean dueOnly, Pageable pageable);

    java.util.Optional<Invoice> findFirstByClientIdOrderByCreatedAtDescIdDesc(Long clientId);

    @EntityGraph(attributePaths = {"client", "lines"})
    @Query("select i from Invoice i where i.id = :id")
    Optional<Invoice> findWithLines(@Param("id") Long id);

    @Query("select l.invoice.id, sum(l.total) from InvoiceLine l where l.invoice.id in :ids group by l.invoice.id")
    java.util.List<Object[]> totalsFor(@Param("ids") java.util.Collection<Long> ids);

    @Query(value = "select nextval('invoice_number_seq')", nativeQuery = true)
    long nextNumber();
}
