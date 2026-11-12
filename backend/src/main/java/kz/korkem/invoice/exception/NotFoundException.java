package kz.korkem.invoice.exception;

import lombok.Getter;

/** 404 with a user-facing text: {@code key} in messages.properties, {@code args} fill its {0}, {1}… */
@Getter
public class NotFoundException extends RuntimeException {
    private final transient Object[] args;

    public NotFoundException(String key, Object... args) {
        super(key);
        this.args = args;
    }
}
