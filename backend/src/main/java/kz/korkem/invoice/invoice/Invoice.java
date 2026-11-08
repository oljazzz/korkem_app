package kz.korkem.invoice.invoice;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import kz.korkem.invoice.client.Client;

@Entity
@Table(name = "invoice")
public class Invoice {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, updatable = false)
    private Long number;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "client_id")
    private Client client;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @Column(updatable = false)
    private String createdBy;

    @OneToMany(mappedBy = "invoice", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("sortOrder ASC, id ASC")
    private List<InvoiceLine> lines = new ArrayList<>();

    public Long getId() { return id; }
    public Long getNumber() { return number; }
    public void setNumber(Long number) { this.number = number; }
    public Client getClient() { return client; }
    public void setClient(Client client) { this.client = client; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }
    public List<InvoiceLine> getLines() { return lines; }

    public void replaceLines(List<InvoiceLine> newLines) {
        lines.clear();
        newLines.forEach(l -> {
            l.setInvoice(this);
            lines.add(l);
        });
    }
}
