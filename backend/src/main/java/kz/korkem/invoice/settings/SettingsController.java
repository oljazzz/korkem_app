package kz.korkem.invoice.settings;

import java.math.BigDecimal;
import kz.korkem.invoice.invoice.InvoiceCalculator;
import kz.korkem.invoice.report.CompanyProperties;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Read-only application settings the UI needs: company details and the VAT rate. */
@RestController
@RequestMapping("/api/settings")
@EnableConfigurationProperties(CompanyProperties.class)
@RequiredArgsConstructor
public class SettingsController {

    public record Settings(CompanyProperties company, BigDecimal vatRate) {}

    private final CompanyProperties company;
    private final InvoiceCalculator calculator;

    @GetMapping
    public Settings settings() {
        return new Settings(company, calculator.rate());
    }
}
