package kz.korkem.invoice.service;

import java.time.Clock;
import kz.korkem.invoice.dto.SettingsDtos.Company;
import kz.korkem.invoice.dto.SettingsDtos.CompanyRequest;
import kz.korkem.invoice.dto.SettingsDtos.Settings;
import kz.korkem.invoice.entities.CompanySettings;
import kz.korkem.invoice.properties.CompanyProperties;
import kz.korkem.invoice.properties.VatProperties;
import kz.korkem.invoice.repository.CompanySettingsRepository;
import kz.korkem.invoice.util.Texts;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Settings the UI needs. Company details live in the database and are edited by admins; until saved once
 * they come from app.company. The VAT rate is server configuration and read-only.
 */
@Service
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class SettingsService {

    private final CompanyProperties defaults;
    private final CompanySettingsRepository settings;
    private final VatProperties vat;
    private final Clock clock;

    public Settings get() {
        return new Settings(company(), vat.rate());
    }

    @Transactional
    public Company updateCompany(CompanyRequest req, String username) {
        CompanySettings s = settings.findById(CompanySettings.ID).orElseGet(CompanySettings::new);
        s.setName(req.name().trim());
        s.setBin(Texts.clean(req.bin()));
        s.setAddress(Texts.clean(req.address()));
        s.setPhone(Texts.clean(req.phone()));
        s.setChiefAccountant(Texts.clean(req.chiefAccountant()));
        s.setReleaseAllowedBy(Texts.clean(req.releaseAllowedBy()));
        s.setUpdatedAt(clock.instant());
        s.setUpdatedBy(username);
        settings.save(s);
        return company();
    }

    private Company company() {
        return settings.findById(CompanySettings.ID)
                .map(s -> new Company(s.getName(), s.getBin(), s.getAddress(), s.getPhone(), s.getChiefAccountant(),
                        s.getReleaseAllowedBy()))
                .orElseGet(() -> new Company(defaults.name(), defaults.bin(), null, null, defaults.chiefAccountant(),
                        defaults.releaseAllowedBy()));
    }
}
