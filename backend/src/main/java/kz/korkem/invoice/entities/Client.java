package kz.korkem.invoice.entities;

import jakarta.persistence.*;
import java.math.BigDecimal;

import kz.korkem.invoice.client.ClientText;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "client")
@Getter
@Setter
@NoArgsConstructor
public class Client {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Setter(lombok.AccessLevel.NONE)
    private Long id;

    @Column(nullable = false)
    private String name;

    private String address;

    /** One or more phone numbers, comma separated. */
    private String phone;

    /** Town or market, used for grouping and search. */
    private String city;

    private String note;

    /** Debt carried over from before payments were tracked in this system. */
    @Column(nullable = false)
    private BigDecimal openingDebt = BigDecimal.ZERO;

    /** Short name for lists: the name without phone numbers typed into it. */
    public String getLabel() {
        String label = ClientText.withoutPhones(name);
        return label == null ? name : label;
    }

    /** Where the client is: town/market if set, otherwise the address without phone numbers. */
    public String getPlace() {
        return city != null && !city.isBlank() ? city : ClientText.withoutPhones(address);
    }

    /** Full name shown on documents: "Name - Address". */
    public String getDisplayName() {
        return address == null || address.isBlank() ? name : name + " - " + address;
    }
}
