package kz.korkem.invoice.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import lombok.RequiredArgsConstructor;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Remembers who made the request in {@value #ATTRIBUTE}, for the access log: TraceIdFilter writes its
 * line after Spring Security has already cleared the security context. Runs after Spring Security.
 */
@Component
@Order(1)
@RequiredArgsConstructor
public class RequestUserFilter extends OncePerRequestFilter {

    public static final String ATTRIBUTE = "korkem.user";

    private final CurrentUser currentUser;

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !request.getRequestURI().startsWith("/api/");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String username = currentUser.username();
        if (username != null) request.setAttribute(ATTRIBUTE, username);
        chain.doFilter(request, response);
    }
}
