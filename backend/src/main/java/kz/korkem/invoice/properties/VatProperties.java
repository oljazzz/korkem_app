package kz.korkem.invoice.properties;

import java.math.BigDecimal;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

/**
 * VAT settings (application.yml → app.vat).
 *
 * @param rate VAT rate in percent, already included in prices (Kazakhstan: 12).
 */
@Validated
@ConfigurationProperties("app.vat")
public record VatProperties(@NotNull @DecimalMin("0") @DecimalMax("100") BigDecimal rate) {}
