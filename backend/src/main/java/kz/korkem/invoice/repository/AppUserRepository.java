package kz.korkem.invoice.repository;

import java.util.Optional;

import kz.korkem.invoice.entities.AppUser;
import kz.korkem.invoice.enums.Role;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AppUserRepository extends JpaRepository<AppUser, Long> {
    Optional<AppUser> findByUsernameIgnoreCase(String username);

    boolean existsByUsernameIgnoreCase(String username);

    long countByRoleAndActiveTrue(Role role);
}
