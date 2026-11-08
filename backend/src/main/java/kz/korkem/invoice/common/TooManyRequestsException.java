package kz.korkem.invoice.common;

import lombok.Getter;

/** 429 with a Retry-After hint. */
@Getter
public class TooManyRequestsException extends RuntimeException {
    private final long retryAfterSeconds;

    public TooManyRequestsException(String message, long retryAfterSeconds) {
        super(message);
        this.retryAfterSeconds = retryAfterSeconds;
    }
}
