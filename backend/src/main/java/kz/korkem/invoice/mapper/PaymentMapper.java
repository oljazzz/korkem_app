package kz.korkem.invoice.mapper;

import kz.korkem.invoice.dto.PaymentDtos.MethodDto;
import kz.korkem.invoice.dto.PaymentDtos.PaymentDto;
import kz.korkem.invoice.entities.Payment;
import kz.korkem.invoice.enums.PaymentMethod;
import kz.korkem.invoice.properties.Messages;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class PaymentMapper {

    private final Messages messages;

    public PaymentDto toDto(Payment p) {
        return new PaymentDto(p.getId(), p.getInvoice().getId(), p.getAmount(), p.getPaidOn(), p.getMethod(),
                messages.label("paymentMethod", p.getMethod()), p.getNote(), p.getCreatedBy(), p.getCreatedAt());
    }

    public MethodDto toDto(PaymentMethod m) {
        return new MethodDto(m, messages.label("paymentMethod", m));
    }
}
