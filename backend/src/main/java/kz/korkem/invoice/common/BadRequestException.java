package kz.korkem.invoice.common;

import lombok.Getter;

/** 400 with a user-facing text: {@code key} in messages.properties, {@code args} fill its {0}, {1}… */
@Getter
public class BadRequestException extends RuntimeException {
    private final transient Object[] args;

    public BadRequestException(String key, Object... args) {
        super(key);
        this.args = args;
    }
}
