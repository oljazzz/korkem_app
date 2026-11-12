package kz.korkem.invoice.entities;

import jakarta.persistence.*;
import java.time.Instant;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Organization details printed on documents; a single row with id 1. */
@Entity
@Table(name = "company_settings")
@Getter
@Setter
@NoArgsConstructor
public class CompanySettings {
    public static final long ID = 1L;

    @Id
    private Long id = ID;

    @Column(nullable = false)
    private String name;

    private String bin;
    private String address;
    private String phone;
    private String chiefAccountant;
    private String releaseAllowedBy;
    private Instant updatedAt;
    private String updatedBy;
}
