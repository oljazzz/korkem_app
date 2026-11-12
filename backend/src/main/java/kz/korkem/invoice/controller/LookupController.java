package kz.korkem.invoice.controller;

import java.util.List;
import kz.korkem.invoice.dto.LookupDto;
import kz.korkem.invoice.service.LookupService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** Drop-down lists. The URLs predate this controller and are kept for the frontend. */
@RestController
@RequiredArgsConstructor
public class LookupController {

    private final LookupService lookups;

    @GetMapping("/api/invoices/units")
    public List<LookupDto> units() {
        return lookups.units();
    }

    @GetMapping("/api/payments/methods")
    public List<LookupDto> paymentMethods() {
        return lookups.paymentMethods();
    }
}
