package kz.korkem.invoice.service;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import kz.korkem.invoice.properties.AuthProperties;
import kz.korkem.invoice.repository.AuditLogRepository;
import org.springframework.stereotype.Service;

/**
 * Throttles password guessing: after N failed logins for one username since its last successful login
 * (or 4×N from one IP, since an office shares an IP behind NAT) within the window, further attempts are
 * rejected until it passes. Failures are read from the audit log, so the limit survives restarts and
 * applies across backend instances.
 */
@Service
public class LoginAttemptService {

    private final int maxFailures;
    private final Duration window;
    private final Clock clock;
    private final AuditLogRepository log;

    public LoginAttemptService(AuthProperties props, Clock clock, AuditLogRepository log) {
        this.maxFailures = props.login().maxFailures();
        this.window = Duration.ofMinutes(props.login().windowMinutes());
        this.clock = clock;
        this.log = log;
    }

    /** Seconds until the next attempt is allowed, or 0 when not blocked. */
    public long blockedForSeconds(String username, String ip) {
        Instant now = clock.instant();
        Instant since = now.minus(window);
        return Math.max(
                retryAfter(log.nthFailedLoginOfUser(username == null ? "" : username.trim(), since, maxFailures), now),
                retryAfter(log.nthFailedLoginFromIp(ip, since, maxFailures * 4), now));
    }

    private long retryAfter(Instant nthFailure, Instant now) {
        return nthFailure == null ? 0 : Math.max(1, Duration.between(now, nthFailure.plus(window)).toSeconds());
    }
}
