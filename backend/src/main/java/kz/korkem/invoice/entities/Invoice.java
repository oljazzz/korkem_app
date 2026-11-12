package kz.korkem.invoice.entities;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "invoice")
@Getter
@Setter
@NoArgsConstructor
public class Invoice {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Setter(AccessLevel.NONE)
    private Long id;

    @Column(nullable = false, unique = true, updatable = false)
    private Long number;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "client_id")
    private Client client;

    /** Document date and time; editable so an invoice can be dated to the day the goods left. */
    @Column(nullable = false)
    private Instant createdAt;

    @Column(updatable = false)
    private String createdBy;

    /** Created before payments were tracked; counts as fully paid and accepts no payments. */
    @Column(nullable = false)
    private boolean legacyPaid;

    @OneToMany(mappedBy = "invoice", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("sortOrder ASC, id ASC")
    @Setter(AccessLevel.NONE)
    private List<InvoiceLine> lines = new ArrayList<>();

    public void replaceLines(List<InvoiceLine> newLines) {
        lines.clear();
        newLines.forEach(l -> {
            l.setInvoice(this);
            lines.add(l);
        });
    }
}
