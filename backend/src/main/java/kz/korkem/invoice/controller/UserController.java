package kz.korkem.invoice.controller;

import jakarta.validation.Valid;
import java.security.Principal;
import java.util.List;
import kz.korkem.invoice.dto.UserDtos.UserDto;
import kz.korkem.invoice.dto.UserDtos.UserRequest;
import kz.korkem.invoice.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

/** User management. Restricted to ADMIN in SecurityConfig. */
@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService users;

    @GetMapping
    public List<UserDto> list() {
        return users.all();
    }

    @GetMapping("/{id}")
    public UserDto get(@PathVariable Long id) {
        return users.get(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public UserDto create(@Valid @RequestBody UserRequest req) {
        return users.create(req);
    }

    @PutMapping("/{id}")
    public UserDto update(@PathVariable Long id, @Valid @RequestBody UserRequest req, Principal principal) {
        return users.update(id, req, principal.getName());
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id, Principal principal) {
        users.delete(id, principal.getName());
    }
}
