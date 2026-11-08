package kz.korkem.invoice.user;

import jakarta.persistence.*;
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
}
