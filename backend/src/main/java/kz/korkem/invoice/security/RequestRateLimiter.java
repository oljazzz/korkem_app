package kz.korkem.invoice.security;

import java.time.Clock;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Counts requests per key (an IP) in fixed one-minute windows. In memory: a restart starts a new
 * window, which is fine for its purpose (stopping floods and scrapers, not counting precisely).
 */
public class RequestRateLimiter {

    private static final long WINDOW_MS = 60_000;

    private final int perMinute;
    private final Clock clock;
    private volatile long window = -1;
    private volatile Map<String, AtomicInteger> counts = new ConcurrentHashMap<>();

    public RequestRateLimiter(int perMinute, Clock clock) {
        this.perMinute = perMinute;
        this.clock = clock;
    }

    /** Counts one request; returns 0 if allowed, else the seconds until the next window starts. */
    public long acquire(String key) {
        long now = clock.millis();
        long current = now / WINDOW_MS;
        if (current != window) {
            synchronized (this) {
                if (current != window) {
                    counts = new ConcurrentHashMap<>(); // the previous minute's counters are dropped whole
                    window = current;
                }
            }
        }
        int n = counts.computeIfAbsent(key == null ? "" : key, k -> new AtomicInteger()).incrementAndGet();
        return n <= perMinute ? 0 : Math.max(1, ((current + 1) * WINDOW_MS - now + 999) / 1000);
    }
}
