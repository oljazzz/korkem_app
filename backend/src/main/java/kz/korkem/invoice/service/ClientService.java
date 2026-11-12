package kz.korkem.invoice.service;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import kz.korkem.invoice.dto.ClientDtos.CityCount;
import kz.korkem.invoice.dto.ClientDtos.ClientDto;
import kz.korkem.invoice.dto.ClientDtos.ClientRequest;
import kz.korkem.invoice.dto.PageResponse;
import kz.korkem.invoice.entities.Client;
import kz.korkem.invoice.exception.NotFoundException;
import kz.korkem.invoice.mapper.ClientMapper;
import kz.korkem.invoice.repository.ClientRepository;
import kz.korkem.invoice.repository.query.ClientBalanceQuery;
import kz.korkem.invoice.util.Texts;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The client directory: search and editing. Debt and purchase figures are in {@link ClientActivityService},
 * merging duplicates in {@link ClientMergeService}.
 */
@Service
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class ClientService {

    private final ClientRepository clients;
    private final ClientBalanceQuery balances;
    private final ClientMapper mapper;

    public PageResponse<ClientDto> search(String q, String city, int page, int size) {
        var result = clients.search(q.trim(), city.trim(),
                PageRequest.of(page, PageResponse.clampSize(size), Sort.by(Sort.Direction.DESC, "name")));
        Map<Long, BigDecimal> debts = balances.debts(result.map(Client::getId).getContent());
        return PageResponse.of(result, c -> mapper.toDto(c, debts.getOrDefault(c.getId(), BigDecimal.ZERO)));
    }

    /** Towns/markets entered for clients, with how many clients each has. */
    public List<CityCount> cities() {
        return clients.cities().stream().map(r -> new CityCount((String) r[0], (Long) r[1])).toList();
    }

    public ClientDto get(Long id) {
        return toDto(find(id));
    }

    @Transactional
    public ClientDto create(ClientRequest req) {
        Client c = new Client();
        apply(c, req);
        return toDto(clients.save(c));
    }

    @Transactional
    public ClientDto update(Long id, ClientRequest req) {
        Client c = find(id);
        apply(c, req);
        clients.flush();
        return toDto(c);
    }

    @Transactional
    public void delete(Long id) {
        clients.delete(find(id));
        clients.flush(); // surface the FK violation here so it maps to 409 when the client has invoices
    }

    private ClientDto toDto(Client c) {
        return mapper.toDto(c, balances.debt(c.getId()));
    }

    private static void apply(Client c, ClientRequest req) {
        c.setName(req.name().trim());
        c.setAddress(Texts.clean(req.address()));
        c.setPhone(Texts.clean(req.phone()));
        c.setCity(Texts.clean(req.city()));
        c.setNote(Texts.clean(req.note()));
        c.setOpeningDebt(req.openingDebt() == null ? BigDecimal.ZERO : req.openingDebt());
    }

    private Client find(Long id) {
        return clients.findById(id).orElseThrow(() -> new NotFoundException("error.client.notFound"));
    }
}
