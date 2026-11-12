package kz.korkem.invoice.properties;

import org.springframework.boot.context.properties.ConfigurationProperties;

/** Organization details printed on documents (application.yml → app.company). */
@ConfigurationProperties("app.company")
public record CompanyProperties(String name, String bin, String chiefAccountant, String releaseAllowedBy) {}
