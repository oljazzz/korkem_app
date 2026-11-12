package kz.korkem.invoice.mapper;

import java.math.BigDecimal;
import kz.korkem.invoice.dto.ClientDtos.ClientDto;
import kz.korkem.invoice.entities.Client;
import org.springframework.stereotype.Component;

@Component
public class ClientMapper {

    public ClientDto toDto(Client c, BigDecimal debt) {
        return new ClientDto(c.getId(), c.getName(), c.getAddress(), c.getPhone(), c.getCity(), c.getNote(),
                c.getOpeningDebt(), c.getDisplayName(), c.getLabel(), c.getPlace(), debt);
    }
}
