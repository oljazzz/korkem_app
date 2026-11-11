package kz.korkem.invoice.user;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.security.Principal;
import java.util.List;
import kz.korkem.invoice.common.BadRequestException;
import kz.korkem.invoice.common.NotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

/** User management. Restricted to ADMIN in SecurityConfig. */
@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    public static final int MIN_PASSWORD_LENGTH = 8;

    public record UserRequest(
            @NotBlank(message = "{validation.username.required}") @Size(max = 100, message = "{validation.username.tooLong}") String username,
            String firstName, String lastName,
            @Email(message = "{validation.email.format}") String email,
            String timeZone,
            @NotNull(message = "{validation.role.required}") Role role,
            boolean active,
            /** Required for a new user; blank on update keeps the current password. */
            @Size(min = MIN_PASSWORD_LENGTH, max = 100, message = "{validation.password.short}") String password) {}

    private final AppUserRepository repo;
    private final PasswordEncoder encoder;

    @GetMapping
    public List<UserDto> list() {
        return repo.findAll(Sort.by("username")).stream().map(UserDto::of).toList();
    }

    @GetMapping("/{id}")
    public UserDto get(@PathVariable Long id) {
        return UserDto.of(find(id));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public UserDto create(@Valid @RequestBody UserRequest req) {
        if (req.password() == null || req.password().isBlank()) {
            throw new BadRequestException("error.user.passwordRequired");
        }
        if (repo.existsByUsernameIgnoreCase(req.username().trim())) {
            throw new BadRequestException("error.user.usernameTaken");
        }
        AppUser u = new AppUser();
        apply(u, req);
        return UserDto.of(repo.save(u));
    }

    @PutMapping("/{id}")
    @Transactional
    public UserDto update(@PathVariable Long id, @Valid @RequestBody UserRequest req, Principal principal) {
        AppUser u = find(id);
        if (!u.getUsername().equalsIgnoreCase(req.username().trim())
                && repo.existsByUsernameIgnoreCase(req.username().trim())) {
            throw new BadRequestException("error.user.usernameTaken");
        }
        boolean self = u.getUsername().equalsIgnoreCase(principal.getName());
        if (self && !req.active()) {
            throw new BadRequestException("error.user.cannotDisableSelf");
        }
        if (self && req.role() != u.getRole()) {
            throw new BadRequestException("error.user.cannotChangeOwnRole");
        }
        boolean losesAdmin = u.getRole() == Role.ADMIN && u.isActive()
                && (req.role() != Role.ADMIN || !req.active());
        if (losesAdmin && repo.countByRoleAndActiveTrue(Role.ADMIN) <= 1) {
            throw new BadRequestException("error.user.lastAdmin");
        }
        apply(u, req);
        return UserDto.of(u);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void delete(@PathVariable Long id, Principal principal) {
        AppUser u = find(id);
        if (u.getUsername().equalsIgnoreCase(principal.getName())) {
            throw new BadRequestException("error.user.cannotDeleteSelf");
        }
        if (u.getRole() == Role.ADMIN && u.isActive() && repo.countByRoleAndActiveTrue(Role.ADMIN) <= 1) {
            throw new BadRequestException("error.user.lastAdmin");
        }
        repo.delete(u);
    }

    private void apply(AppUser u, UserRequest req) {
        u.setUsername(req.username().trim());
        u.setFirstName(req.firstName());
        u.setLastName(req.lastName());
        u.setEmail(req.email());
        u.setTimeZone(req.timeZone());
        u.setRole(req.role());
        u.setActive(req.active());
        if (req.password() != null && !req.password().isBlank()) {
            u.setPasswordHash(encoder.encode(req.password()));
        }
    }

    private AppUser find(Long id) {
        return repo.findById(id).orElseThrow(() -> new NotFoundException("error.user.notFound"));
    }
}
