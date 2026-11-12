package kz.korkem.invoice.dto;

import java.util.List;
import java.util.function.Function;
import org.springframework.data.domain.Page;

/** Stable JSON shape for paged lists (instead of serializing Spring Data's Page). */
public record PageResponse<T>(List<T> items, long total, int page, int size) {

    /** Upper bound for the page size a client may request. */
    public static final int MAX_SIZE = 200;

    public static <E, T> PageResponse<T> of(Page<E> page, Function<E, T> mapper) {
        return new PageResponse<>(page.map(mapper).getContent(), page.getTotalElements(),
                page.getNumber(), page.getSize());
    }

    /** Clamps a requested page size to 1..MAX_SIZE. */
    public static int clampSize(int size) {
        return Math.max(1, Math.min(size, MAX_SIZE));
    }
}
