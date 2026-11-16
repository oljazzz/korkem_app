package kz.korkem.invoice.service;

import java.util.List;
import kz.korkem.invoice.entities.AppUser;
import kz.korkem.invoice.repository.AppUserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.core.convert.converter.Converter;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.InvalidBearerTokenException;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;

/**
 * Turns a valid JWT into an authentication backed by the current database state:
 * a deleted or deactivated user, or a token issued before the user's sessions were revoked, is
 * rejected immediately (not when the token expires), and the role always comes from the database.
 * A user who must change their password gets no role at all until they do.
 */
@Component
@RequiredArgsConstructor
public class UserJwtConverter implements Converter<Jwt, AbstractAuthenticationToken> {

    /** The only authority of a user who must replace an admin-set password. */
    public static final String PASSWORD_CHANGE_REQUIRED = "PASSWORD_CHANGE_REQUIRED";

    private final AppUserRepository users;

    @Override
    public AbstractAuthenticationToken convert(Jwt jwt) {
        AppUser user = users.findByUsernameIgnoreCase(jwt.getSubject())
                .filter(AppUser::isActive)
                .orElseThrow(() -> new InvalidBearerTokenException("User is unknown or disabled"));
        if (TokenService.version(jwt) != user.getTokenVersion()) {
            throw new InvalidBearerTokenException("Session was revoked");
        }
        String authority = user.isMustChangePassword() ? PASSWORD_CHANGE_REQUIRED : "ROLE_" + user.getRole().name();
        return new JwtAuthenticationToken(jwt, List.of(new SimpleGrantedAuthority(authority)), user.getUsername());
    }
}
