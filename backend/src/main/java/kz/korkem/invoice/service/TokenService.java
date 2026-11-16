package kz.korkem.invoice.service;

import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import kz.korkem.invoice.entities.AppUser;
import kz.korkem.invoice.properties.AuthProperties;
import kz.korkem.invoice.properties.JwtProperties;
import lombok.RequiredArgsConstructor;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.stereotype.Service;

/**
 * Issues session JWTs. A session lasts at most {@code app.jwt.ttl-hours} from login ({@code auth_time});
 * each token expires after {@code app.auth.idle-minutes} and is renewed while the user keeps working.
 * {@code ver} is the user's token version: raising it revokes every token issued before.
 */
@Service
@RequiredArgsConstructor
public class TokenService {

    public static final String VERSION = "ver";
    static final String AUTH_TIME = "auth_time";
    public static final String REMEMBER = "rem";

    /** A signed token, valid until {@code expiresAt}; the session itself can be renewed until {@code endsAt}. */
    public record Session(String token, Instant issuedAt, Instant expiresAt, Instant endsAt, boolean remember) {}

    private final JwtEncoder encoder;
    private final JwtProperties jwtProps;
    private final AuthProperties authProps;
    private final Clock clock;

    /** A new session, starting now. */
    public Session start(AppUser user, boolean remember) {
        Instant now = clock.instant();
        return issue(user.getUsername(), user.getTokenVersion(), now, now.plus(jwtProps.ttlHours(), ChronoUnit.HOURS),
                remember);
    }

    /** The same session with its idle time reset, or null when it cannot be extended any further. */
    public Session renew(Jwt jwt) {
        Instant authTime = Instant.ofEpochSecond(number(jwt, AUTH_TIME, jwt.getIssuedAt().getEpochSecond()));
        Instant endsAt = authTime.plus(jwtProps.ttlHours(), ChronoUnit.HOURS);
        if (jwt.getExpiresAt() != null && !jwt.getExpiresAt().isBefore(endsAt)) return null;
        return issue(jwt.getSubject(), (int) number(jwt, VERSION, 0), authTime, endsAt,
                Boolean.TRUE.equals(jwt.getClaimAsBoolean(REMEMBER)));
    }

    /** The token version a JWT was issued with; tokens from before versions existed count as 0. */
    public static int version(Jwt jwt) {
        return (int) number(jwt, VERSION, 0);
    }

    private Session issue(String username, int version, Instant authTime, Instant endsAt, boolean remember) {
        Instant now = clock.instant();
        Instant exp = authProps.idleMinutes() > 0 ? min(now.plus(authProps.idleMinutes(), ChronoUnit.MINUTES), endsAt) : endsAt;
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer(JwtProperties.ISSUER)
                .subject(username)
                .issuedAt(now)
                .expiresAt(exp)
                .claim(VERSION, version)
                .claim(AUTH_TIME, authTime.getEpochSecond())
                .claim(REMEMBER, remember)
                .build();
        String token = encoder.encode(JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).build(), claims))
                .getTokenValue();
        return new Session(token, now, exp, endsAt, remember);
    }

    private static long number(Jwt jwt, String claim, long fallback) {
        return jwt.getClaim(claim) instanceof Number n ? n.longValue() : fallback;
    }

    private static Instant min(Instant a, Instant b) {
        return a.isBefore(b) ? a : b;
    }
}
