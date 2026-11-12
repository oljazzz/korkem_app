package kz.korkem.invoice.service;

import java.util.List;
import kz.korkem.invoice.dto.UserDtos.UserDto;
import kz.korkem.invoice.dto.UserDtos.UserRequest;
import kz.korkem.invoice.entities.AppUser;
import kz.korkem.invoice.enums.Role;
import kz.korkem.invoice.exception.BadRequestException;
import kz.korkem.invoice.exception.NotFoundException;
import kz.korkem.invoice.mapper.UserMapper;
import kz.korkem.invoice.repository.AppUserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** User management. {@code currentUsername} is the admin doing the change: nobody can lock themselves out. */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class UserService {

    private final AppUserRepository repo;
    private final PasswordEncoder encoder;
    private final UserMapper mapper;

    public List<UserDto> all() {
        return repo.findAll(Sort.by("username")).stream().map(mapper::toDto).toList();
    }

    public UserDto get(Long id) {
        return mapper.toDto(find(id));
    }

    public UserDto byUsername(String username) {
        return repo.findByUsernameIgnoreCase(username)
                .map(mapper::toDto)
                .orElseThrow(() -> new NotFoundException("error.user.notFound"));
    }

    @Transactional
    public UserDto create(UserRequest req) {
        if (req.password() == null || req.password().isBlank()) {
            throw new BadRequestException("error.user.passwordRequired");
        }
        if (repo.existsByUsernameIgnoreCase(req.username().trim())) {
            throw new BadRequestException("error.user.usernameTaken");
        }
        AppUser u = new AppUser();
        apply(u, req);
        return mapper.toDto(repo.save(u));
    }

    @Transactional
    public UserDto update(Long id, UserRequest req, String currentUsername) {
        AppUser u = find(id);
        if (!u.getUsername().equalsIgnoreCase(req.username().trim())
                && repo.existsByUsernameIgnoreCase(req.username().trim())) {
            throw new BadRequestException("error.user.usernameTaken");
        }
        boolean self = u.getUsername().equalsIgnoreCase(currentUsername);
        if (self && !req.active()) {
            throw new BadRequestException("error.user.cannotDisableSelf");
        }
        if (self && req.role() != u.getRole()) {
            throw new BadRequestException("error.user.cannotChangeOwnRole");
        }
        boolean losesAdmin = u.getRole() == Role.ADMIN && u.isActive()
                && (req.role() != Role.ADMIN || !req.active());
        if (losesAdmin && isLastAdmin()) {
            throw new BadRequestException("error.user.lastAdmin");
        }
        apply(u, req);
        return mapper.toDto(u);
    }

    @Transactional
    public void delete(Long id, String currentUsername) {
        AppUser u = find(id);
        if (u.getUsername().equalsIgnoreCase(currentUsername)) {
            throw new BadRequestException("error.user.cannotDeleteSelf");
        }
        if (u.getRole() == Role.ADMIN && u.isActive() && isLastAdmin()) {
            throw new BadRequestException("error.user.lastAdmin");
        }
        repo.delete(u);
    }

    private boolean isLastAdmin() {
        return repo.countByRoleAndActiveTrue(Role.ADMIN) <= 1;
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
