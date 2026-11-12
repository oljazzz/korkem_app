package kz.korkem.invoice.exception;

import java.util.Map;
import lombok.Getter;
import org.springframework.http.HttpStatus;

/** 429 with a Retry-After hint. */
@Getter
public class TooManyRequestsException extends ApiException {

    private final long retryAfterSeconds;

    public TooManyRequestsException(long retryAfterSeconds, String key, Object... args) {
        super(HttpStatus.TOO_MANY_REQUESTS, key, args);
        this.retryAfterSeconds = retryAfterSeconds;
    }

    @Override
    public Map<String, String> headers() {
        return Map.of("Retry-After", String.valueOf(retryAfterSeconds));
    }
}
