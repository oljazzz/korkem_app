package kz.korkem.invoice.repository;

import kz.korkem.invoice.entities.Client;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ClientRepository extends JpaRepository<Client, Long> {

    @Query("""
            select c from Client c
            where (lower(c.name) like lower(concat('%', :q, '%'))
               or lower(coalesce(c.address, '')) like lower(concat('%', :q, '%'))
               or lower(coalesce(c.city, '')) like lower(concat('%', :q, '%'))
               or replace(coalesce(c.phone, ''), ' ', '') like concat('%', replace(:q, ' ', ''), '%'))
              and (:city = '' or lower(c.city) = lower(:city))
            """)
    Page<Client> search(@Param("q") String q, @Param("city") String city, Pageable pageable);

    @Query("select c.city, count(c) from Client c where c.city is not null and c.city <> '' group by c.city order by count(c) desc, c.city")
    java.util.List<Object[]> cities();
}
