package kz.korkem.invoice.invoice;

import jakarta.validation.Valid;
import java.security.Principal;
import java.util.Arrays;
import java.util.List;
import kz.korkem.invoice.common.PageResponse;
import kz.korkem.invoice.invoice.InvoiceDtos.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/invoices")
@RequiredArgsConstructor
public class InvoiceController {

    public record UnitDto(Unit value, String label) {}

    private final InvoiceService service;

    @GetMapping
    public PageResponse<InvoiceListItem> list(@RequestParam(defaultValue = "") String q,
                                              @RequestParam(required = false) Long clientId,
                                              @RequestParam(defaultValue = "0") int page,
                                              @RequestParam(defaultValue = "50") int size) {
        return service.list(q, clientId, page, size);
    }

    @GetMapping("/units")
    public List<UnitDto> units() {
        return Arrays.stream(Unit.values()).map(u -> new UnitDto(u, u.getLabel())).toList();
    }

    @GetMapping("/{id}")
    public InvoiceDto get(@PathVariable Long id) {
        return service.get(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public InvoiceDto create(@Valid @RequestBody InvoiceRequest req, Principal principal) {
        return service.create(req, principal == null ? null : principal.getName());
    }

    @PutMapping("/{id}")
    public InvoiceDto update(@PathVariable Long id, @Valid @RequestBody InvoiceRequest req) {
        return service.update(id, req);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        service.delete(id);
    }
}
