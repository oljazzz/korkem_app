package kz.korkem.invoice.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import kz.korkem.invoice.service.TokenService;
import lombok.RequiredArgsConstructor;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpHeaders;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Keeps an active browser session alive: a request made with the session cookie gets a fresh token
 * (its idle time reset) once the current one is a minute old. A session nobody uses expires after the
 * idle limit, and none outlives the token lifetime counted from login. Runs after Spring Security
 * (order 0 > its -100), so only tokens that were accepted are renewed.
 */
@Component
@Order(0)
@RequiredArgsConstructor
public class SessionRenewalFilter extends OncePerRequestFilter {

    private static final Duration RENEW_AFTER = Duration.ofMinutes(1);

    private final TokenService tokens;
    private final SessionCookie cookie;
    private final Clock clock;

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String uri = request.getRequestURI();
        // The auth endpoints set (or clear) the cookie themselves; /me is the exception, it only reads
        return !uri.startsWith("/api/") || (uri.startsWith("/api/auth/") && !uri.equals("/api/auth/me"));
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        if (SecurityContextHolder.getContext().getAuthentication() instanceof JwtAuthenticationToken auth
                && fromCookie(request, auth.getToken().getTokenValue())
                && auth.getToken().getIssuedAt() != null
                && auth.getToken().getIssuedAt().plus(RENEW_AFTER).isBefore(clock.instant())) {
            TokenService.Session renewed = tokens.renew(auth.getToken());
            if (renewed != null) {
                response.addHeader(HttpHeaders.SET_COOKIE, cookie.set(renewed));
            }
        }
        chain.doFilter(request, response);
    }

    /** Only browser sessions are renewed; API clients sending the token in a header are not. */
    private boolean fromCookie(HttpServletRequest request, String token) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) return false;
        for (Cookie c : cookies) {
            if (cookie.name().equals(c.getName()) && token.equals(c.getValue())) return true;
        }
        return false;
    }
}
