package kz.korkem.invoice.security;

import java.time.Duration;
import kz.korkem.invoice.properties.AuthProperties;
import kz.korkem.invoice.service.TokenService.Session;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

/**
 * The session cookie: httpOnly (page scripts never read the token) and SameSite=Strict (the browser
 * does not send it on cross-site requests, which is the CSRF protection). "Remember me" keeps it across
 * browser restarts until the session's end; otherwise it ends with the browser session.
 */
@Component
@RequiredArgsConstructor
public class SessionCookie {

    private final AuthProperties props;

    public String name() {
        return props.cookie().name();
    }

    /** Set-Cookie value carrying {@code session}. */
    public String set(Session session) {
        Duration maxAge = session.remember() ? Duration.between(session.issuedAt(), session.endsAt()) : null;
        return cookie(session.token(), maxAge);
    }

    /** Set-Cookie value deleting the cookie. */
    public String clear() {
        return cookie("", Duration.ZERO);
    }

    private String cookie(String value, Duration maxAge) {
        ResponseCookie.ResponseCookieBuilder b = ResponseCookie.from(props.cookie().name(), value)
                .httpOnly(true)
                .secure(props.cookie().secure())
                .sameSite("Strict")
                .path("/api");
        if (maxAge != null) {
            b.maxAge(maxAge);
        }
        return b.build().toString();
    }
}
