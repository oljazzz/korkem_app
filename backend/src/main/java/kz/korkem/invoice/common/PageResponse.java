package kz.korkem.invoice.common;

import java.util.List;
import java.util.function.Function;
import org.springframework.data.domain.Page;

/** Беттеп қайтарылатын тізім (Spring Data Page-ті тұрақты JSON пішініне айналдырады). */
public record PageResponse<T>(List<T> items, long total, int page, int size) {
    public static <E, T> PageResponse<T> of(Page<E> page, Function<E, T> mapper) {
        return new PageResponse<>(page.map(mapper).getContent(), page.getTotalElements(),
                page.getNumber(), page.getSize());
    }
}
