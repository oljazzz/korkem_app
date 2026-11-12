package kz.korkem.invoice.common;

import java.util.LinkedHashMap;
import java.util.Map;

import kz.korkem.invoice.properties.Messages;
import kz.korkem.invoice.exception.ApiException;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/**
 * Maps exceptions to a uniform {message, fields} error body. Exceptions carry a key of
 * messages.properties; the user-facing (Kazakh) text is looked up here.
 */
@RestControllerAdvice
@RequiredArgsConstructor
public class ApiExceptionHandler {

    public record ApiError(String message, Map<String, String> fields) {}

    private final Messages messages;

    @ExceptionHandler(ApiException.class)
    ResponseEntity<ApiError> api(ApiException e) {
        var response = ResponseEntity.status(e.getStatus());
        e.headers().forEach(response::header);
        return response.body(new ApiError(messages.get(e.getMessage(), e.getArgs()), null));
    }

    /** Field texts come already resolved: annotations name their key as message = "{key}". */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ApiError> validation(MethodArgumentNotValidException e) {
        Map<String, String> fields = new LinkedHashMap<>();
        e.getBindingResult().getFieldErrors()
                .forEach(f -> fields.putIfAbsent(f.getField(), f.getDefaultMessage()));
        return error(HttpStatus.BAD_REQUEST, messages.get("error.validation"), fields);
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    ResponseEntity<ApiError> conflict(DataIntegrityViolationException e) {
        return error(HttpStatus.CONFLICT, messages.get("error.conflict"), null);
    }

    @ExceptionHandler({BadCredentialsException.class, DisabledException.class})
    ResponseEntity<ApiError> badCredentials(RuntimeException e) {
        return error(HttpStatus.UNAUTHORIZED, messages.get("error.badCredentials"), null);
    }

    private ResponseEntity<ApiError> error(HttpStatus status, String message, Map<String, String> fields) {
        return ResponseEntity.status(status).body(new ApiError(message, fields));
    }
}
