package kz.korkem.invoice.client;

import jakarta.persistence.*;
import java.math.BigDecimal;
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

    /** Name shown in lists: "Name - Address". */
    public String getDisplayName() {
        return address == null || address.isBlank() ? name : name + " - " + address;
    }
}
