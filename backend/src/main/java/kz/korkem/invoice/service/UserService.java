package kz.korkem.invoice.service;

import jakarta.validation.Valid;
import kz.korkem.invoice.controller.UserController;
import kz.korkem.invoice.dto.UserDto;
import kz.korkem.invoice.entities.AppUser;
import kz.korkem.invoice.enums.Role;
import kz.korkem.invoice.exception.BadRequestException;
import kz.korkem.invoice.exception.NotFoundException;
import kz.korkem.invoice.repository.AppUserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;

import java.security.Principal;
import java.util.List;

@Service
@RequiredArgsConstructor
public class UserService {

    private final AppUserRepository repo;
    private final PasswordEncoder encoder;

    public List<UserDto> getUsers() {
        return repo.findAll(Sort.by("username")).stream().map(UserDto::of).toList();
    }

    public UserDto getUser(Long id) {
        return UserDto.of(find(id));
    }

    public UserDto create(@Valid @RequestBody UserController.UserRequest req) {
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

    @Transactional
    public UserDto update(@PathVariable Long id, @Valid @RequestBody UserController.UserRequest req, Principal principal) {
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

    private void apply(AppUser u, UserController.UserRequest req) {
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
