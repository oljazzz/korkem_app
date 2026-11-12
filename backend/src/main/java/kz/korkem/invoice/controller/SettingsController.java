package kz.korkem.invoice.controller;

import jakarta.validation.Valid;
import java.security.Principal;
import kz.korkem.invoice.dto.SettingsDtos.Company;
import kz.korkem.invoice.dto.SettingsDtos.CompanyRequest;
import kz.korkem.invoice.dto.SettingsDtos.Settings;
import kz.korkem.invoice.service.SettingsService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

/** Application settings; PUT is admin-only (SecurityConfig). */
@RestController
@RequestMapping("/api/settings")
@RequiredArgsConstructor
public class SettingsController {

    private final SettingsService settings;

    @GetMapping
    public Settings settings() {
        return settings.get();
    }

    @PutMapping("/company")
    public Company updateCompany(@Valid @RequestBody CompanyRequest req, Principal principal) {
        return settings.updateCompany(req, principal == null ? null : principal.getName());
    }
}
