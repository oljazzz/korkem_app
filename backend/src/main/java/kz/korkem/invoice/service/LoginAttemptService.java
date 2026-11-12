package kz.korkem.invoice.service;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import kz.korkem.invoice.properties.AuthProperties;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

/**
 * Throttles password guessing: after N failed logins for one username (or 4×N from one IP, since an
 * office shares an IP behind NAT) within the window, further attempts are rejected until it passes.
 * In-memory, so it applies per backend instance.
 */
@Service
public class LoginAttemptService {

    private final int maxFailures;
    private final Duration window;
    private final Clock clock;
    private final Map<String, Deque<Instant>> failures = new ConcurrentHashMap<>();

    @Autowired
    public LoginAttemptService(AuthProperties props) {
        this(props, Clock.systemUTC());
    }

    LoginAttemptService(AuthProperties props, Clock clock) {
        this.maxFailures = props.login().maxFailures();
        this.window = Duration.ofMinutes(props.login().windowMinutes());
        this.clock = clock;
    }

    /** Seconds until the next attempt is allowed, or 0 when not blocked. */
    public long blockedForSeconds(String username, String ip) {
        return Math.max(retryAfter(userKey(username), maxFailures), retryAfter(ipKey(ip), maxFailures * 4));
    }

    public void recordFailure(String username, String ip) {
        Instant now = clock.instant();
        for (String key : new String[] {userKey(username), ipKey(ip)}) {
            Deque<Instant> q = failures.computeIfAbsent(key, k -> new ArrayDeque<>());
            synchronized (q) {
                prune(q, now);
                q.addLast(now);
            }
        }
    }

    public void recordSuccess(String username) {
        failures.remove(userKey(username));
    }

    private long retryAfter(String key, int limit) {
        Deque<Instant> q = failures.get(key);
        if (q == null) {
            return 0;
        }
        synchronized (q) {
            Instant now = clock.instant();
            prune(q, now);
            if (q.size() < limit) {
                return 0;
            }
            Instant unblockAt = q.stream().skip(q.size() - limit).findFirst().orElseThrow().plus(window);
            return Math.max(1, Duration.between(now, unblockAt).toSeconds());
        }
    }

    private void prune(Deque<Instant> q, Instant now) {
        while (!q.isEmpty() && q.peekFirst().plus(window).isBefore(now)) {
            q.pollFirst();
        }
    }

    private static String userKey(String username) {
        return "u:" + (username == null ? "" : username.trim().toLowerCase(Locale.ROOT));
    }

    private static String ipKey(String ip) {
        return "ip:" + ip;
    }
}
