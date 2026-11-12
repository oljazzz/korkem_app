package kz.korkem.invoice.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;

/** Request and response bodies of /api/settings. */
public final class SettingsDtos {

    private SettingsDtos() {}

    public record Company(String name, String bin, String address, String phone, String chiefAccountant,
                          String releaseAllowedBy) {}

    public record Settings(Company company, BigDecimal vatRate) {}

    public record CompanyRequest(
            @NotBlank(message = "{validation.name.required}") @Size(max = 255, message = "{validation.tooLong}") String name,
            @Pattern(regexp = "^$|^\\d{12}$", message = "{validation.bin.format}") String bin,
            @Size(max = 500, message = "{validation.tooLong}") String address,
            @Size(max = 100, message = "{validation.tooLong}") String phone,
            @Size(max = 255, message = "{validation.tooLong}") String chiefAccountant,
            @Size(max = 255, message = "{validation.tooLong}") String releaseAllowedBy) {}
}
