package kz.korkem.invoice.controller;

import jakarta.validation.Valid;
import java.util.List;
import kz.korkem.invoice.dto.ClientDtos.CityCount;
import kz.korkem.invoice.dto.ClientDtos.ClientDto;
import kz.korkem.invoice.dto.ClientDtos.ClientRequest;
import kz.korkem.invoice.dto.PageResponse;
import kz.korkem.invoice.service.ClientService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

/** The client directory: search and editing. */
@RestController
@RequestMapping("/api/clients")
@RequiredArgsConstructor
public class ClientController {

    private final ClientService clients;

    @GetMapping
    public PageResponse<ClientDto> list(@RequestParam(defaultValue = "") String q,
                                        @RequestParam(defaultValue = "") String city,
                                        @RequestParam(defaultValue = "0") int page,
                                        @RequestParam(defaultValue = "50") int size) {
        return clients.search(q, city, page, size);
    }

    @GetMapping("/cities")
    public List<CityCount> cities() {
        return clients.cities();
    }

    @GetMapping("/{id}")
    public ClientDto get(@PathVariable Long id) {
        return clients.get(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ClientDto create(@Valid @RequestBody ClientRequest req) {
        return clients.create(req);
    }

    @PutMapping("/{id}")
    public ClientDto update(@PathVariable Long id, @Valid @RequestBody ClientRequest req) {
        return clients.update(id, req);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        clients.delete(id);
    }
}
