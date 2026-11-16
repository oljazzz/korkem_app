package kz.korkem.invoice.entities;

import jakarta.persistence.*;
import java.time.Instant;
import kz.korkem.invoice.enums.Role;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "app_user")
@Getter
@Setter
@NoArgsConstructor
public class AppUser {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Setter(AccessLevel.NONE)
    private Long id;

    @Column(nullable = false, unique = true)
    private String username;

    @Column(nullable = false)
    private String passwordHash;

    private String firstName;
    private String lastName;
    private String email;
    private String timeZone;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Role role = Role.MANAGER;

    @Column(nullable = false)
    private boolean active = true;

    /** Carried in every JWT; a token with another version is rejected. */
    @Column(nullable = false)
    @Setter(AccessLevel.NONE)
    private int tokenVersion;

    /** The password was set by an admin: the user must replace it before doing anything else. */
    @Column(nullable = false)
    private boolean mustChangePassword;

    private Instant passwordChangedAt;

    /** Ends every session of the user: tokens issued before this call stop working. */
    public void revokeTokens() {
        tokenVersion++;
    }
}
