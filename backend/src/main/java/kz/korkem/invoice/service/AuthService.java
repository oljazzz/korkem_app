package kz.korkem.invoice.service;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import kz.korkem.invoice.dto.UserDtos.UserDto;
import kz.korkem.invoice.exception.TooManyRequestsException;
import kz.korkem.invoice.properties.JwtProperties;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.stereotype.Service;

/** Checks the password (with throttling) and issues the JWT. How the token reaches the browser is the controller's job. */
@Service
@RequiredArgsConstructor
public class AuthService {

    /** A signed token valid from {@code issuedAt} to {@code expiresAt}. */
    public record Login(String token, Instant issuedAt, Instant expiresAt, UserDto user) {}

    private final AuthenticationManager authManager;
    private final JwtEncoder encoder;
    private final JwtProperties jwtProps;
    private final LoginAttemptService attempts;
    private final UserService users;

    public Login login(String username, String password, String ip) {
        String name = username.trim();
        long wait = attempts.blockedForSeconds(name, ip);
        if (wait > 0) {
            throw new TooManyRequestsException(wait, "error.auth.tooManyAttempts", String.valueOf(Math.max(1, (wait + 59) / 60)));
        }
        Authentication auth;
        try {
            auth = authManager.authenticate(UsernamePasswordAuthenticationToken.unauthenticated(name, password));
        } catch (AuthenticationException e) {
            attempts.recordFailure(name, ip);
            throw e;
        }
        attempts.recordSuccess(name);

        Instant now = Instant.now();
        Instant exp = now.plus(jwtProps.ttlHours(), ChronoUnit.HOURS);
        return new Login(token(auth.getName(), now, exp), now, exp, users.byUsername(auth.getName()));
    }

    private String token(String subject, Instant now, Instant exp) {
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer(JwtProperties.ISSUER)
                .subject(subject)
                .issuedAt(now)
                .expiresAt(exp)
                .build();
        return encoder.encode(JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).build(), claims))
                .getTokenValue();
    }
}
