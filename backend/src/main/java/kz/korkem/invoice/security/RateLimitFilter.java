package kz.korkem.invoice.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.util.Map;
import kz.korkem.invoice.properties.Messages;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import tools.jackson.databind.json.JsonMapper;

/**
 * Limits API requests per IP (app.rate-limit.per-minute; 0 turns it off), before authentication, so
 * floods are cut off cheaply whoever sends them. Runs after TraceIdFilter, so refusals are access-logged.
 */
@Slf4j
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 20)
public class RateLimitFilter extends OncePerRequestFilter {

    private final RequestRateLimiter limiter;
    private final String body;

    public RateLimitFilter(@Value("${app.rate-limit.per-minute:600}") int perMinute, Clock clock, Messages messages) {
        this.limiter = perMinute > 0 ? new RequestRateLimiter(perMinute, clock) : null;
        this.body = JsonMapper.builder().build().writeValueAsString(Map.of("message", messages.get("error.tooManyRequests")));
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String uri = request.getRequestURI();
        return limiter == null || !uri.startsWith("/api/") || uri.equals("/api/health");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        long wait = limiter.acquire(request.getRemoteAddr());
        if (wait > 0) {
            log.warn("Rate limit hit by {}", request.getRemoteAddr());
            response.setStatus(429);
            response.setHeader("Retry-After", String.valueOf(wait));
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.setCharacterEncoding(StandardCharsets.UTF_8.name());
            response.getWriter().write(body);
            return;
        }
        chain.doFilter(request, response);
    }
}
