package kz.korkem.invoice.security;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.security.oauth2.server.resource.web.BearerTokenResolver;
import org.springframework.security.oauth2.server.resource.web.DefaultBearerTokenResolver;

/** Reads the JWT from the auth cookie (browser) or, failing that, the Authorization header (API clients). */
public class CookieOrHeaderTokenResolver implements BearerTokenResolver {

    private final String cookieName;
    private final DefaultBearerTokenResolver header = new DefaultBearerTokenResolver();

    public CookieOrHeaderTokenResolver(String cookieName) {
        this.cookieName = cookieName;
    }

    @Override
    public String resolve(HttpServletRequest request) {
        // A stale cookie must not block signing in or out: these endpoints never read the token
        String uri = request.getRequestURI();
        if (uri.endsWith("/api/auth/login") || uri.endsWith("/api/auth/logout")) {
            return null;
        }
        String fromHeader = header.resolve(request);
        if (fromHeader != null) {
            return fromHeader;
        }
        Cookie[] cookies = request.getCookies();
        if (cookies != null) {
            for (Cookie c : cookies) {
                if (cookieName.equals(c.getName()) && !c.getValue().isBlank()) {
                    return c.getValue();
                }
            }
        }
        return null;
    }
}
