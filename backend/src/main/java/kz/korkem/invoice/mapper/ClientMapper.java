package kz.korkem.invoice.mapper;

import java.math.BigDecimal;
import kz.korkem.invoice.dto.ClientDtos.ClientDto;
import kz.korkem.invoice.entities.Client;
import kz.korkem.invoice.util.Snapshot;
import org.springframework.stereotype.Component;

@Component
public class ClientMapper {

    public ClientDto toDto(Client c, BigDecimal debt) {
        return new ClientDto(c.getId(), c.getName(), c.getAddress(), c.getPhone(), c.getCity(), c.getNote(),
                c.getOpeningDebt(), c.getDisplayName(), c.getLabel(), c.getPlace(), debt);
    }

    public Snapshot audit(Client c) {
        return Snapshot.of()
                .put("name", c.getName())
                .put("address", c.getAddress())
                .put("phone", c.getPhone())
                .put("city", c.getCity())
                .put("note", c.getNote())
                .put("openingDebt", c.getOpeningDebt());
    }
}
