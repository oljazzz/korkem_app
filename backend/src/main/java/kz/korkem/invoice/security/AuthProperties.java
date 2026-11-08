package kz.korkem.invoice.security;

import org.springframework.boot.context.properties.ConfigurationProperties;

/** Authentication settings (application.yml → app.auth) plus the deployment environment (app.env). */
@ConfigurationProperties("app.auth")
public record AuthProperties(Cookie cookie, Login login) {

    public record Cookie(String name, boolean secure) {}

    public record Login(int maxFailures, int windowMinutes) {}
}
