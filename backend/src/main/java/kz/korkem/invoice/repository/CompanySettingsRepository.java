package kz.korkem.invoice.repository;

import kz.korkem.invoice.entities.CompanySettings;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CompanySettingsRepository extends JpaRepository<CompanySettings, Long> {}
