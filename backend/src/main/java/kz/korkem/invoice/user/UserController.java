package kz.korkem.invoice.user;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.security.Principal;
import java.util.List;
import kz.korkem.invoice.common.BadRequestException;
import kz.korkem.invoice.common.NotFoundException;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/users")
public class UserController {

    public record UserRequest(
            @NotBlank(message = "Логинді енгізіңіз") String username,
            String firstName, String lastName,
            @Email(message = "Email қате") String email,
            String timeZone,
            boolean active,
            /** Жаңа пайдаланушы үшін міндетті; өзгертуде бос болса — пароль өзгермейді. */
            @Size(min = 4, message = "Пароль кемінде 4 символ") String password) {}

    private final AppUserRepository repo;
    private final PasswordEncoder encoder;

    public UserController(AppUserRepository repo, PasswordEncoder encoder) {
        this.repo = repo;
        this.encoder = encoder;
    }

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
            throw new BadRequestException("Парольді енгізіңіз");
        }
        if (repo.existsByUsernameIgnoreCase(req.username().trim())) {
            throw new BadRequestException("Мұндай логин бар");
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
            throw new BadRequestException("Мұндай логин бар");
        }
        if (!req.active() && u.getUsername().equals(principal.getName())) {
            throw new BadRequestException("Өз аккаунтыңызды өшіре алмайсыз");
        }
        apply(u, req);
        return UserDto.of(u);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void delete(@PathVariable Long id, Principal principal) {
        AppUser u = find(id);
        if (u.getUsername().equals(principal.getName())) {
            throw new BadRequestException("Өз аккаунтыңызды жоя алмайсыз");
        }
        repo.delete(u);
    }

    private void apply(AppUser u, UserRequest req) {
        u.setUsername(req.username().trim());
        u.setFirstName(req.firstName());
        u.setLastName(req.lastName());
        u.setEmail(req.email());
        u.setTimeZone(req.timeZone());
        u.setActive(req.active());
        if (req.password() != null && !req.password().isBlank()) {
            u.setPasswordHash(encoder.encode(req.password()));
        }
    }

    private AppUser find(Long id) {
        return repo.findById(id).orElseThrow(() -> new NotFoundException("Пайдаланушы табылмады"));
    }
}
