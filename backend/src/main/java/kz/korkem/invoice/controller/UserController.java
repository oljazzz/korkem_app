package kz.korkem.invoice.controller;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import kz.korkem.invoice.dto.UserDto;
import kz.korkem.invoice.enums.Role;
import kz.korkem.invoice.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;

/**
 * User management. Restricted to ADMIN in SecurityConfig.
 */
@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    public static final int MIN_PASSWORD_LENGTH = 8;
    private final UserService userService;

    public record UserRequest(
            @NotBlank(message = "{validation.username.required}") @Size(max = 100, message = "{validation.username.tooLong}") String username,
            String firstName, String lastName,
            @Email(message = "{validation.email.format}") String email,
            String timeZone,
            @NotNull(message = "{validation.role.required}") Role role,
            boolean active,
            @Size(min = MIN_PASSWORD_LENGTH, max = 100, message = "{validation.password.short}") String password) {
    }

    @GetMapping
    public List<UserDto> list() {
        return userService.getUsers();
    }

    @GetMapping("/{id}")
    public UserDto get(@PathVariable Long id) {
        return userService.getUser(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public UserDto create(@Valid @RequestBody UserRequest req) {
        return userService.create(req);
    }

    @PutMapping("/{id}")
    public UserDto update(@PathVariable Long id, @Valid @RequestBody UserRequest req, Principal principal) {
        return userService.update(id, req, principal);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void delete(@PathVariable Long id, Principal principal) {
        userService.delete(id, principal);
    }
}
