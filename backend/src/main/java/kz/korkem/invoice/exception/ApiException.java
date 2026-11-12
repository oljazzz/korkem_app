package kz.korkem.invoice.exception;

import java.util.Map;
import lombok.Getter;
import org.springframework.http.HttpStatus;

/**
 * An error the user sees: {@code key} in messages.properties, {@code args} fill its {0}, {1}…
 * A new kind of error is a subclass with its status; ApiExceptionHandler needs no change.
 */
@Getter
public abstract class ApiException extends RuntimeException {

    private final HttpStatus status;
    private final transient Object[] args;

    protected ApiException(HttpStatus status, String key, Object... args) {
        super(key);
        this.status = status;
        this.args = args;
    }

    /** Extra response headers. */
    public Map<String, String> headers() {
        return Map.of();
    }
}
