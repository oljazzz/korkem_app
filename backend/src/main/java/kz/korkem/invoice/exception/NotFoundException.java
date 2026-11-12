package kz.korkem.invoice.exception;

import org.springframework.http.HttpStatus;

/** 404: the record does not exist. */
public class NotFoundException extends ApiException {

    public NotFoundException(String key, Object... args) {
        super(HttpStatus.NOT_FOUND, key, args);
    }
}
