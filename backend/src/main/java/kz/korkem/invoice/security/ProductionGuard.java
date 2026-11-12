package kz.korkem.invoice.security;

import java.util.ArrayList;
import java.util.List;

import kz.korkem.invoice.properties.AuthProperties;
import kz.korkem.invoice.properties.JwtProperties;
import org.springframework.beans.factory.InitializingBean;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Refuses to start in prod (app.env=prod) with development defaults:
 * the sample JWT secret, the default admin password or cookies without the Secure flag.
 */
@Component
public class ProductionGuard implements InitializingBean {

    static final String DEV_JWT_SECRET = "dev-secret-change-me-dev-secret-change-me-1234";

    private final String env;
    private final JwtProperties jwt;
    private final AuthProperties auth;
    private final String adminPassword;

    public ProductionGuard(@Value("${app.env:dev}") String env, JwtProperties jwt, AuthProperties auth,
                           @Value("${app.admin.password}") String adminPassword) {
        this.env = env;
        this.jwt = jwt;
        this.auth = auth;
        this.adminPassword = adminPassword;
    }

    public boolean isProd() {
        return "prod".equalsIgnoreCase(env);
    }

    @Override
    public void afterPropertiesSet() {
        if (!isProd()) {
            return;
        }
        List<String> problems = new ArrayList<>();
        if (jwt.secret() == null || jwt.secret().length() < 32 || DEV_JWT_SECRET.equals(jwt.secret())) {
            problems.add("JWT_SECRET must be set to a random value of at least 32 characters");
        }
        if (adminPassword == null || adminPassword.length() < 8) {
            problems.add("ADMIN_PASSWORD must be set (at least 8 characters, not 'admin')");
        }
        if (!auth.cookie().secure()) {
            problems.add("COOKIE_SECURE must be true (serve the app over HTTPS)");
        }
        if (!problems.isEmpty()) {
            throw new IllegalStateException("Insecure production configuration: " + String.join("; ", problems));
        }
    }
}
