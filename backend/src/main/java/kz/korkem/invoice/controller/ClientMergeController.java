package kz.korkem.invoice.controller;

import jakarta.validation.Valid;
import java.util.List;
import kz.korkem.invoice.dto.ClientDtos.MergePlan;
import kz.korkem.invoice.dto.ClientDtos.MergeRequest;
import kz.korkem.invoice.dto.ClientDtos.MergeResult;
import kz.korkem.invoice.dto.ClientDtos.MergeSide;
import kz.korkem.invoice.service.ClientMergeService;
import kz.korkem.invoice.security.AdminOnly;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

/** Finding and merging duplicate clients. */
@RestController
@RequestMapping("/api/clients")
@RequiredArgsConstructor
public class ClientMergeController {

    private final ClientMergeService merger;

    /** Clients sharing a phone number; in each group the first one would stay after a merge. */
    @GetMapping("/duplicates")
    public List<List<MergeSide>> duplicates() {
        return merger.duplicates();
    }

    /** Which of the two clients would stay (newer last invoice) and which would be removed. */
    @GetMapping("/merge-plan")
    public MergePlan mergePlan(@RequestParam Long clientId, @RequestParam Long otherId) {
        return merger.plan(clientId, otherId);
    }

    /** Invoices move to the primary client, the other is deleted. */
    @AdminOnly
    @PostMapping("/merge")
    public MergeResult merge(@Valid @RequestBody MergeRequest req) {
        return merger.merge(req.clientId(), req.otherId());
    }
}
