package kz.korkem.invoice.tracing;

import io.micrometer.tracing.Span;
import io.micrometer.tracing.Tracer;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Returns the request's traceId in {@value #HEADER} and writes one access-log line per API call.
 * Runs right after the observation filter that starts the trace, and before Spring Security,
 * so rejected requests (401/403) are traced too. A user reporting an error can quote the id,
 * and grepping the log for it shows the request, its slow queries and any exception.
 */
@Slf4j
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
@RequiredArgsConstructor
public class TraceIdFilter extends OncePerRequestFilter {

    public static final String HEADER = "X-Trace-Id";

    private final Tracer tracer;

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !request.getRequestURI().startsWith("/api/");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        Span span = tracer.currentSpan();
        if (span != null) {
            response.setHeader(HEADER, span.context().traceId());
        }
        long start = System.nanoTime();
        try {
            chain.doFilter(request, response);
            log.info("{} {} -> {} in {} ms", request.getMethod(), request.getRequestURI(), response.getStatus(), since(start));
        } catch (IOException | ServletException | RuntimeException e) {
            // Logged here, while the trace is still current, so the stack trace carries the traceId
            log.error("{} {} -> 500 in {} ms", request.getMethod(), request.getRequestURI(), since(start), e);
            throw e;
        }
    }

    private static long since(long start) {
        return (System.nanoTime() - start) / 1_000_000;
    }
}
