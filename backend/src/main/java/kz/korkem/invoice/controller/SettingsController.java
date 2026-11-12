package kz.korkem.invoice.controller;

import jakarta.validation.Valid;
import java.security.Principal;
import kz.korkem.invoice.dto.SettingsDtos.Company;
import kz.korkem.invoice.dto.SettingsDtos.CompanyRequest;
import kz.korkem.invoice.dto.SettingsDtos.Settings;
import kz.korkem.invoice.service.SettingsService;
import kz.korkem.invoice.security.AdminOnly;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

/** Application settings; only admins change them. */
@RestController
@RequestMapping("/api/settings")
@RequiredArgsConstructor
public class SettingsController {

    private final SettingsService settings;

    @GetMapping
    public Settings settings() {
        return settings.get();
    }

    @AdminOnly
    @PutMapping("/company")
    public Company updateCompany(@Valid @RequestBody CompanyRequest req, Principal principal) {
        return settings.updateCompany(req, principal.getName());
    }
}
