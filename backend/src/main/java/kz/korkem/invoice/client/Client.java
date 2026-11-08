package kz.korkem.invoice.client;

import jakarta.persistence.*;
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

    /** Name shown in lists: "Name - Address". */
    public String getDisplayName() {
        return address == null || address.isBlank() ? name : name + " - " + address;
    }
}
