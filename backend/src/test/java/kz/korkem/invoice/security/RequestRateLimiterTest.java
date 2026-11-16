package kz.korkem.invoice.security;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import org.junit.jupiter.api.Test;

class RequestRateLimiterTest {

    private Instant now = Instant.parse("2026-11-16T10:00:15Z");
    private final Clock clock = new Clock() {
        @Override public ZoneOffset getZone() { return ZoneOffset.UTC; }
        @Override public Clock withZone(java.time.ZoneId zone) { return this; }
        @Override public Instant instant() { return now; }
    };

    @Test
    void limitsEachIpPerMinute() {
        RequestRateLimiter limiter = new RequestRateLimiter(3, clock);
        for (int i = 0; i < 3; i++) assertEquals(0, limiter.acquire("10.0.0.1"));
        long wait = limiter.acquire("10.0.0.1");
        assertEquals(45, wait);
        assertEquals(0, limiter.acquire("10.0.0.2"), "another IP has its own budget");

        now = Instant.parse("2026-11-16T10:01:00Z");
        assertEquals(0, limiter.acquire("10.0.0.1"), "a new minute starts afresh");
        assertTrue(wait > 0);
    }
}
