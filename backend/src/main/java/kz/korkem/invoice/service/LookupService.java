package kz.korkem.invoice.service;

import java.util.Arrays;
import java.util.List;
import kz.korkem.invoice.dto.LookupDto;
import kz.korkem.invoice.enums.PaymentMethod;
import kz.korkem.invoice.enums.Unit;
import kz.korkem.invoice.properties.Messages;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * Fixed lists the UI offers in drop-downs. Labels come from messages.properties as {@code <key>.<NAME>},
 * so a new enum value needs only its label; a new list needs only one method here.
 */
@Service
@RequiredArgsConstructor
public class LookupService {

    private final Messages messages;

    public List<LookupDto> units() {
        return of(Unit.class, "unit");
    }

    public List<LookupDto> paymentMethods() {
        return of(PaymentMethod.class, "paymentMethod");
    }

    private <E extends Enum<E>> List<LookupDto> of(Class<E> type, String key) {
        return Arrays.stream(type.getEnumConstants())
                .map(e -> new LookupDto(e.name(), messages.label(key, e)))
                .toList();
    }
}
