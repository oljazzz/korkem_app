package kz.korkem.invoice.security;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

import kz.korkem.invoice.properties.AuthProperties;
import kz.korkem.invoice.properties.JwtProperties;
import org.junit.jupiter.api.Test;

class ProductionGuardTest {

    private static final String STRONG = "f3a9c1d7e5b24680a1c3e5f7092b4d6f8a0c2e4f";
    private final AuthProperties secureCookie = new AuthProperties(new AuthProperties.Cookie("t", true), new AuthProperties.Login(5, 15));
    private final AuthProperties insecureCookie = new AuthProperties(new AuthProperties.Cookie("t", false), new AuthProperties.Login(5, 15));

    @Test
    void devAllowsDefaults() {
        assertDoesNotThrow(() -> new ProductionGuard("dev", new JwtProperties(ProductionGuard.DEV_JWT_SECRET, 12),
                insecureCookie, "admin").afterPropertiesSet());
    }

    @Test
    void prodRejectsDefaults() {
        assertThrows(IllegalStateException.class, () -> new ProductionGuard("prod",
                new JwtProperties(ProductionGuard.DEV_JWT_SECRET, 12), secureCookie, "Str0ng-pass").afterPropertiesSet());
        assertThrows(IllegalStateException.class, () -> new ProductionGuard("prod",
                new JwtProperties(STRONG, 12), secureCookie, "admin").afterPropertiesSet());
        assertThrows(IllegalStateException.class, () -> new ProductionGuard("prod",
                new JwtProperties(STRONG, 12), insecureCookie, "Str0ng-pass").afterPropertiesSet());
    }

    @Test
    void prodAcceptsStrongConfig() {
        assertDoesNotThrow(() -> new ProductionGuard("prod", new JwtProperties(STRONG, 12), secureCookie, "Str0ng-pass")
                .afterPropertiesSet());
    }
}
