package kz.korkem.invoice.report;

import org.springframework.boot.context.properties.ConfigurationProperties;

/** Басып шығарылатын құжаттардағы ұйым деректері (application.yml → app.company). */
@ConfigurationProperties("app.company")
public record CompanyProperties(String name, String chiefAccountant, String releaseAllowedBy) {}
