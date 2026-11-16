package kz.korkem.invoice.service;

import java.util.Optional;
import kz.korkem.invoice.domain.PasswordPolicy;
import kz.korkem.invoice.dto.UserDtos.UserDto;
import kz.korkem.invoice.entities.AppUser;
import kz.korkem.invoice.enums.AuditAction;
import kz.korkem.invoice.enums.AuditEntityType;
import kz.korkem.invoice.enums.LoginFailure;
import kz.korkem.invoice.exception.BadRequestException;
import kz.korkem.invoice.exception.NotFoundException;
import kz.korkem.invoice.exception.TooManyRequestsException;
import kz.korkem.invoice.mapper.UserMapper;
import kz.korkem.invoice.repository.AppUserRepository;
import kz.korkem.invoice.util.Snapshot;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Login (with throttling), a user's own password change and ending all of their sessions. Every
 * login, failed or not, goes to the audit log. How the token reaches the browser is the controller's job.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    /** A started session and who it belongs to. */
    public record Login(TokenService.Session session, UserDto user) {}

    private final AuthenticationManager authManager;
    private final TokenService tokens;
    private final LoginAttemptService attempts;
    private final AppUserRepository users;
    private final UserMapper mapper;
    private final PasswordEncoder encoder;
    private final AuditService audit;
    private final java.time.Clock clock;

    public Login login(String username, String password, boolean remember, String ip) {
        String name = username.trim();
        throttle(name, ip);
        Authentication auth;
        try {
            auth = authManager.authenticate(UsernamePasswordAuthenticationToken.unauthenticated(name, password));
        } catch (AuthenticationException e) {
            failed(users.findByUsernameIgnoreCase(name));
            throw e;
        }
        AppUser user = users.findByUsernameIgnoreCase(auth.getName()).orElseThrow();
        // "Remember me" is noted only when ticked: most logins would otherwise carry a "no"
        audit.session(AuditAction.LOGIN, user.getUsername(), user.getId(), Snapshot.of().put("remember", remember ? true : null));
        return new Login(tokens.start(user, remember), mapper.toDto(user));
    }

    /**
     * Replaces the user's password after checking the current one. Every other session of theirs ends;
     * the returned one replaces the session making the request.
     */
    @Transactional
    public Login changePassword(String username, String currentPassword, String newPassword, boolean remember, String ip) {
        throttle(username, ip);
        AppUser u = users.findByUsernameIgnoreCase(username).orElseThrow(() -> new NotFoundException("error.user.notFound"));
        if (!encoder.matches(currentPassword, u.getPasswordHash())) {
            // Counts as a failed login: a stolen session must not become a way to guess the password
            failed(Optional.of(u));
            throw new BadRequestException("error.password.wrongCurrent");
        }
        if (encoder.matches(newPassword, u.getPasswordHash())) {
            throw new BadRequestException("error.password.same");
        }
        PasswordPolicy.check(newPassword, u.getUsername());
        Snapshot before = mapper.audit(u);
        u.setPasswordHash(encoder.encode(newPassword));
        u.setPasswordChangedAt(clock.instant());
        u.setMustChangePassword(false);
        u.revokeTokens();
        audit.updated(AuditEntityType.USER, u.getId(), u.getUsername(), before, mapper.audit(u).put("password", "***"));
        return new Login(tokens.start(u, remember), mapper.toDto(u));
    }

    /** Ends every session of {@code username}, on every device, including the current one. */
    @Transactional
    public void signOutEverywhere(String username) {
        AppUser u = users.findByUsernameIgnoreCase(username).orElseThrow(() -> new NotFoundException("error.user.notFound"));
        u.revokeTokens();
        audit.event(AuditAction.LOGOUT_ALL, AuditEntityType.USER, u.getId(), u.getUsername(), Snapshot.of());
    }

    private void throttle(String username, String ip) {
        long wait = attempts.blockedForSeconds(username, ip);
        if (wait > 0) {
            log.warn("Login of '{}' from {} refused: too many failed attempts", username, ip);
            throw new TooManyRequestsException(wait, "error.auth.tooManyAttempts", String.valueOf(Math.max(1, (wait + 59) / 60)));
        }
    }

    /**
     * Records a failed login. For an unknown login nothing identifying is stored (people sometimes type
     * their password into the login field); such failures still count against the IP.
     */
    private void failed(Optional<AppUser> user) {
        LoginFailure reason = user.isEmpty() ? LoginFailure.UNKNOWN_USER
                : user.get().isActive() ? LoginFailure.BAD_PASSWORD : LoginFailure.DISABLED;
        audit.session(AuditAction.LOGIN_FAILED, user.map(AppUser::getUsername).orElse(null),
                user.map(AppUser::getId).orElse(null), Snapshot.of().put("reason", reason));
    }
}
