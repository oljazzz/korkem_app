package kz.korkem.invoice.payment;

import java.math.BigDecimal;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PaymentRepository extends JpaRepository<Payment, Long> {

    List<Payment> findByInvoiceIdOrderByPaidOnAscIdAsc(Long invoiceId);

    boolean existsByInvoiceId(Long invoiceId);

    @Query("select coalesce(sum(p.amount), 0) from Payment p where p.invoice.id = :invoiceId")
    BigDecimal paidFor(@Param("invoiceId") Long invoiceId);

    /** Rows of [invoiceId, paid] for the given invoices. */
    @Query("select p.invoice.id, sum(p.amount) from Payment p where p.invoice.id in :ids group by p.invoice.id")
    List<Object[]> paidFor(@Param("ids") Collection<Long> ids);
}
