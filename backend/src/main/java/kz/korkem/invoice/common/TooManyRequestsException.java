package kz.korkem.invoice.common;

import lombok.Getter;

/** 429 with a Retry-After hint; the text is {@code key} in messages.properties. */
@Getter
public class TooManyRequestsException extends RuntimeException {
    private final long retryAfterSeconds;
    private final transient Object[] args;

    public TooManyRequestsException(long retryAfterSeconds, String key, Object... args) {
        super(key);
        this.retryAfterSeconds = retryAfterSeconds;
        this.args = args;
    }
}
