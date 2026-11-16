package kz.korkem.invoice.properties;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Authentication settings (application.yml → app.auth). {@code idleMinutes}: a session nobody uses for
 * that long ends; 0 turns the idle limit off (sessions then last the token's full lifetime).
 */
@ConfigurationProperties("app.auth")
public record AuthProperties(Cookie cookie, Login login, int idleMinutes) {

    public record Cookie(String name, boolean secure) {}

    public record Login(int maxFailures, int windowMinutes) {}
}
