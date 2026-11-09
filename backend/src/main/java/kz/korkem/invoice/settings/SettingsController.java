package kz.korkem.invoice.settings;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.security.Principal;
import java.time.Instant;
import kz.korkem.invoice.invoice.InvoiceCalculator;
import kz.korkem.invoice.report.CompanyProperties;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

/**
 * Application settings the UI needs. Company details live in the database and are edited by admins
 * (PUT is admin-only in SecurityConfig); until saved once they come from app.company. The VAT rate is
 * server configuration and read-only here.
 */
@RestController
@RequestMapping("/api/settings")
@EnableConfigurationProperties(CompanyProperties.class)
@RequiredArgsConstructor
public class SettingsController {

    public record Company(String name, String bin, String address, String phone, String chiefAccountant,
                          String releaseAllowedBy) {}

    public record Settings(Company company, BigDecimal vatRate) {}

    public record CompanyRequest(
            @NotBlank(message = "Атауын енгізіңіз") @Size(max = 255, message = "Тым ұзын") String name,
            @Pattern(regexp = "^$|^\\d{12}$", message = "БСН/ЖСН 12 цифрдан тұрады") String bin,
            @Size(max = 500, message = "Тым ұзын") String address,
            @Size(max = 100, message = "Тым ұзын") String phone,
            @Size(max = 255, message = "Тым ұзын") String chiefAccountant,
            @Size(max = 255, message = "Тым ұзын") String releaseAllowedBy) {}

    private final CompanyProperties defaults;
    private final CompanySettingsRepository repo;
    private final InvoiceCalculator calculator;

    @GetMapping
    public Settings settings() {
        return new Settings(company(), calculator.rate());
    }

    @PutMapping("/company")
    @Transactional
    public Company updateCompany(@Valid @RequestBody CompanyRequest req, Principal principal) {
        CompanySettings s = repo.findById(CompanySettings.ID).orElseGet(CompanySettings::new);
        s.setName(req.name().trim());
        s.setBin(clean(req.bin()));
        s.setAddress(clean(req.address()));
        s.setPhone(clean(req.phone()));
        s.setChiefAccountant(clean(req.chiefAccountant()));
        s.setReleaseAllowedBy(clean(req.releaseAllowedBy()));
        s.setUpdatedAt(Instant.now());
        s.setUpdatedBy(principal == null ? null : principal.getName());
        repo.save(s);
        return company();
    }

    private Company company() {
        return repo.findById(CompanySettings.ID)
                .map(s -> new Company(s.getName(), s.getBin(), s.getAddress(), s.getPhone(), s.getChiefAccountant(),
                        s.getReleaseAllowedBy()))
                .orElseGet(() -> new Company(defaults.name(), defaults.bin(), null, null, defaults.chiefAccountant(),
                        defaults.releaseAllowedBy()));
    }

    private static String clean(String v) {
        return v == null || v.isBlank() ? null : v.trim();
    }
}
