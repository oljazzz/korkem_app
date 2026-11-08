package kz.korkem.invoice.security;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import java.security.Principal;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import kz.korkem.invoice.common.NotFoundException;
import kz.korkem.invoice.common.TooManyRequestsException;
import kz.korkem.invoice.user.AppUserRepository;
import kz.korkem.invoice.user.UserDto;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.web.bind.annotation.*;

/**
 * Login issues the JWT as an httpOnly, SameSite=Strict cookie: page scripts can never read it,
 * and the browser does not send it on cross-site requests (CSRF protection).
 */
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    public record LoginRequest(@NotBlank String username, @NotBlank String password, Boolean remember) {}

    public record LoginResponse(Instant expiresAt, UserDto user) {}

    private final AuthenticationManager authManager;
    private final JwtEncoder encoder;
    private final JwtProperties jwtProps;
    private final AuthProperties authProps;
    private final LoginAttemptService attempts;
    private final AppUserRepository users;

    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(@Valid @RequestBody LoginRequest req, HttpServletRequest http) {
        String username = req.username().trim();
        String ip = http.getRemoteAddr();
        long wait = attempts.blockedForSeconds(username, ip);
        if (wait > 0) {
            throw new TooManyRequestsException(
                    "Тым көп сәтсіз әрекет. " + Math.max(1, (wait + 59) / 60) + " минуттан кейін қайталаңыз", wait);
        }
        Authentication auth;
        try {
            auth = authManager.authenticate(UsernamePasswordAuthenticationToken.unauthenticated(username, req.password()));
        } catch (AuthenticationException e) {
            attempts.recordFailure(username, ip);
            throw e;
        }
        attempts.recordSuccess(username);

        Instant now = Instant.now();
        Instant exp = now.plus(jwtProps.ttlHours(), ChronoUnit.HOURS);
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer(JwtProperties.ISSUER)
                .subject(auth.getName())
                .issuedAt(now)
                .expiresAt(exp)
                .build();
        String token = encoder.encode(JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).build(), claims))
                .getTokenValue();
        // "Remember me" keeps the cookie until the token expires; otherwise it ends with the browser session
        ResponseCookie cookie = cookie(token, Boolean.TRUE.equals(req.remember()) ? Duration.between(now, exp) : null);
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, cookie.toString())
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .body(new LoginResponse(exp, me(auth::getName)));
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout() {
        return ResponseEntity.noContent()
                .header(HttpHeaders.SET_COOKIE, cookie("", Duration.ZERO).toString())
                .build();
    }

    @GetMapping("/me")
    public UserDto me(Principal principal) {
        return users.findByUsernameIgnoreCase(principal.getName())
                .map(UserDto::of)
                .orElseThrow(() -> new NotFoundException("Пайдаланушы табылмады"));
    }

    private ResponseCookie cookie(String value, Duration maxAge) {
        ResponseCookie.ResponseCookieBuilder b = ResponseCookie.from(authProps.cookie().name(), value)
                .httpOnly(true)
                .secure(authProps.cookie().secure())
                .sameSite("Strict")
                .path("/api");
        if (maxAge != null) {
            b.maxAge(maxAge);
        }
        return b.build();
    }
}
