package kz.korkem.invoice.service;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import kz.korkem.invoice.constants.DateProps;
import kz.korkem.invoice.dto.ReconciliationDtos.Entry;
import kz.korkem.invoice.dto.ReconciliationDtos.Reconciliation;
import kz.korkem.invoice.entities.Client;
import kz.korkem.invoice.exception.BadRequestException;
import kz.korkem.invoice.exception.NotFoundException;
import kz.korkem.invoice.mapper.ClientMapper;
import kz.korkem.invoice.repository.ClientRepository;
import kz.korkem.invoice.repository.query.ClientBalanceQuery;
import kz.korkem.invoice.repository.query.ReconciliationQuery;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The reconciliation statement: the balance at the start of the period, every invoice and payment in it,
 * and the balance at the end. Over a period up to today the closing balance equals the client's debt.
 */
@Service
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class ReconciliationService {

    private final ClientRepository clients;
    private final ClientBalanceQuery balances;
    private final ReconciliationQuery query;
    private final ClientMapper mapper;
    private final Clock clock;

    /** Without dates: from the 1st of January to today. */
    public Reconciliation of(Long clientId, LocalDate from, LocalDate to) {
        Client c = clients.findById(clientId).orElseThrow(() -> new NotFoundException("error.client.notFound"));
        LocalDate end = to != null ? to : LocalDate.now(clock.withZone(DateProps.ZONE));
        LocalDate start = from != null ? from : end.withDayOfYear(1);
        if (start.isAfter(end)) {
            throw new BadRequestException("error.report.badPeriod");
        }
        BigDecimal opening = query.balanceBefore(clientId, start);
        var entries = query.entries(clientId, start, end);
        BigDecimal debit = entries.stream().map(Entry::debit).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal credit = entries.stream().map(Entry::credit).reduce(BigDecimal.ZERO, BigDecimal::add);
        return new Reconciliation(mapper.toDto(c, balances.debt(clientId)), start, end, opening, entries,
                debit, credit, opening.add(debit).subtract(credit));
    }
}
