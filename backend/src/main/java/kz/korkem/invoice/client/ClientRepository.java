package kz.korkem.invoice.client;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ClientRepository extends JpaRepository<Client, Long> {

    @Query("""
            select c from Client c
            where lower(c.name) like lower(concat('%', :q, '%'))
               or lower(coalesce(c.address, '')) like lower(concat('%', :q, '%'))
            """)
    Page<Client> search(@Param("q") String q, Pageable pageable);
}
