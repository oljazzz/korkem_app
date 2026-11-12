package kz.korkem.invoice.properties;

import org.springframework.boot.context.properties.ConfigurationProperties;

/** JWT settings (application.yml → app.jwt). */
@ConfigurationProperties("app.jwt")
public record JwtProperties(String secret, long ttlHours) {
    public static final String ISSUER = "korkem-invoice";
}
