package kz.korkem.invoice.exception;

import org.springframework.http.HttpStatus;

/** 400: the request breaks a business rule. */
public class BadRequestException extends ApiException {

    public BadRequestException(String key, Object... args) {
        super(HttpStatus.BAD_REQUEST, key, args);
    }
}
