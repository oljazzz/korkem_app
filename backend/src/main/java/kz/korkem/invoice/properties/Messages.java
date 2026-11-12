package kz.korkem.invoice.properties;

import lombok.RequiredArgsConstructor;
import org.springframework.context.MessageSource;
import org.springframework.context.i18n.LocaleContextHolder;
import org.springframework.stereotype.Component;

/** User-facing texts from messages.properties, looked up by key. */
@Component
@RequiredArgsConstructor
public class Messages {

    private final MessageSource source;

    /** Text for {@code key}, with {0}, {1}… filled from {@code args}. */
    public String get(String key, Object... args) {
        return source.getMessage(key, args, LocaleContextHolder.getLocale());
    }

    /** Label of an enum constant: key {@code prefix.NAME}, e.g. "unit.SHT". */
    public String label(String prefix, Enum<?> value) {
        return get(prefix + "." + value.name());
    }
}
