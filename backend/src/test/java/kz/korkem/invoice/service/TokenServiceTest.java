package kz.korkem.invoice.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.nimbusds.jose.jwk.source.ImmutableSecret;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import javax.crypto.spec.SecretKeySpec;
import kz.korkem.invoice.entities.AppUser;
import kz.korkem.invoice.properties.AuthProperties;
import kz.korkem.invoice.properties.JwtProperties;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;

class TokenServiceTest {

    private final SecretKeySpec key = new SecretKeySpec(
            "test-secret-test-secret-test-secret-12".getBytes(StandardCharsets.UTF_8), "HmacSHA256");
    private Instant now = Instant.parse("2026-11-16T08:00:00Z");
    private final Clock clock = new Clock() {
        @Override public ZoneOffset getZone() { return ZoneOffset.UTC; }
        @Override public Clock withZone(java.time.ZoneId zone) { return this; }
        @Override public Instant instant() { return now; }
    };
    private final TokenService tokens = new TokenService(new NimbusJwtEncoder(new ImmutableSecret<>(key)),
            new JwtProperties("unused", 12),
            new AuthProperties(new AuthProperties.Cookie("t", false), new AuthProperties.Login(5, 15), 120), clock);

    @Test
    void sessionExpiresWhenIdleButRenewsUpToItsEnd() {
        AppUser user = new AppUser();
        user.setUsername("aigerim");
        user.revokeTokens();

        TokenService.Session s = tokens.start(user, true);
        assertEquals(now.plus(Duration.ofMinutes(120)), s.expiresAt());
        assertEquals(now.plus(Duration.ofHours(12)), s.endsAt());
        Jwt jwt = decode(s.token());
        assertEquals(1, TokenService.version(jwt));

        // Renewed while in use: same login time, version and "remember me", idle time reset
        now = now.plus(Duration.ofMinutes(100));
        TokenService.Session renewed = tokens.renew(jwt);
        assertEquals(now.plus(Duration.ofMinutes(120)), renewed.expiresAt());
        assertEquals(s.endsAt(), renewed.endsAt());
        assertTrue(renewed.remember());
        assertEquals(1, TokenService.version(decode(renewed.token())));

        // Near the end it is capped, and then it cannot be renewed at all
        now = s.endsAt().minus(Duration.ofMinutes(30));
        TokenService.Session last = tokens.renew(decode(renewed.token()));
        assertEquals(s.endsAt(), last.expiresAt());
        assertNull(tokens.renew(decode(last.token())));
    }

    private Jwt decode(String token) {
        NimbusJwtDecoder decoder = NimbusJwtDecoder.withSecretKey(key).macAlgorithm(MacAlgorithm.HS256).build();
        decoder.setJwtValidator(j -> org.springframework.security.oauth2.core.OAuth2TokenValidatorResult.success());
        return decoder.decode(token);
    }
}
