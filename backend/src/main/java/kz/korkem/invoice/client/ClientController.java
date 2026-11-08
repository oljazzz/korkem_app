package kz.korkem.invoice.client;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import kz.korkem.invoice.common.NotFoundException;
import kz.korkem.invoice.common.PageResponse;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/clients")
public class ClientController {

    public record ClientDto(Long id, String name, String address, String displayName) {
        static ClientDto of(Client c) {
            return new ClientDto(c.getId(), c.getName(), c.getAddress(), c.getDisplayName());
        }
    }

    public record ClientRequest(@NotBlank(message = "Атын енгізіңіз") String name, String address) {}

    private final ClientRepository repo;

    public ClientController(ClientRepository repo) {
        this.repo = repo;
    }

    @GetMapping
    public PageResponse<ClientDto> list(@RequestParam(defaultValue = "") String q,
                                        @RequestParam(defaultValue = "0") int page,
                                        @RequestParam(defaultValue = "50") int size) {
        return PageResponse.of(repo.search(q.trim(), PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "name"))),
                ClientDto::of);
    }

    @GetMapping("/{id}")
    public ClientDto get(@PathVariable Long id) {
        return ClientDto.of(find(id));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public ClientDto create(@Valid @RequestBody ClientRequest req) {
        Client c = new Client();
        apply(c, req);
        return ClientDto.of(repo.save(c));
    }

    @PutMapping("/{id}")
    @Transactional
    public ClientDto update(@PathVariable Long id, @Valid @RequestBody ClientRequest req) {
        Client c = find(id);
        apply(c, req);
        return ClientDto.of(c);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void delete(@PathVariable Long id) {
        repo.delete(find(id));
        repo.flush(); // накладнойда қолданылса, 409 қайтару үшін қатені осында шығарамыз
    }

    private void apply(Client c, ClientRequest req) {
        c.setName(req.name().trim());
        c.setAddress(req.address() == null ? null : req.address().trim());
    }

    private Client find(Long id) {
        return repo.findById(id).orElseThrow(() -> new NotFoundException("Клиент табылмады"));
    }
}
