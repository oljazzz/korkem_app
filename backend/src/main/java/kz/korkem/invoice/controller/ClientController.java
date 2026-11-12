package kz.korkem.invoice.controller;

import jakarta.validation.Valid;
import java.util.List;
import kz.korkem.invoice.dto.ClientDtos.CityCount;
import kz.korkem.invoice.dto.ClientDtos.ClientDto;
import kz.korkem.invoice.dto.ClientDtos.ClientRequest;
import kz.korkem.invoice.dto.ClientDtos.ClientSummary;
import kz.korkem.invoice.dto.ClientDtos.Debts;
import kz.korkem.invoice.dto.ClientDtos.MergePlan;
import kz.korkem.invoice.dto.ClientDtos.MergeRequest;
import kz.korkem.invoice.dto.ClientDtos.MergeResult;
import kz.korkem.invoice.dto.ClientDtos.MergeSide;
import kz.korkem.invoice.dto.InvoiceDtos.InvoiceDto;
import kz.korkem.invoice.dto.PageResponse;
import kz.korkem.invoice.service.ClientService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

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

    @GetMapping("/debtors")
    public Debts debtors(@RequestParam(defaultValue = "50") int limit) {
        return clients.debtors(limit);
    }

    @GetMapping("/duplicates")
    public List<List<MergeSide>> duplicates() {
        return clients.duplicates();
    }

    /** Which of the two clients would stay (newer last invoice) and which would be removed. */
    @GetMapping("/merge-plan")
    public MergePlan mergePlan(@RequestParam Long clientId, @RequestParam Long otherId) {
        return clients.mergePlan(clientId, otherId);
    }

    /** Admin only (SecurityConfig): invoices move to the primary client, the other is deleted. */
    @PostMapping("/merge")
    public MergeResult merge(@Valid @RequestBody MergeRequest req) {
        return clients.merge(req.clientId(), req.otherId());
    }

    @GetMapping("/{id}")
    public ClientDto get(@PathVariable Long id) {
        return clients.get(id);
    }

    @GetMapping("/{id}/summary")
    public ClientSummary summary(@PathVariable Long id) {
        return clients.summary(id);
    }

    /** 404 when the client has no invoices yet. */
    @GetMapping("/{id}/last-invoice")
    public InvoiceDto lastInvoice(@PathVariable Long id) {
        return clients.lastInvoice(id);
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
