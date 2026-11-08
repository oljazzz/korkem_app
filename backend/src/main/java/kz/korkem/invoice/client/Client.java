package kz.korkem.invoice.client;

import jakarta.persistence.*;

@Entity
@Table(name = "client")
public class Client {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    private String address;

    public Long getId() { return id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getAddress() { return address; }
    public void setAddress(String address) { this.address = address; }

    /** Тізімдерде көрсетілетін атау: "Аты - Мекенжайы". */
    public String getDisplayName() {
        return address == null || address.isBlank() ? name : name + " - " + address;
    }
}
