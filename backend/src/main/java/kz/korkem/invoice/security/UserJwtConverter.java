package kz.korkem.invoice.security;

import java.util.List;
import kz.korkem.invoice.user.AppUser;
import kz.korkem.invoice.user.AppUserRepository;
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
 * a deleted or deactivated user is rejected immediately (not when the token expires),
 * and the role always comes from the database, never from the token.
 */
@Component
@RequiredArgsConstructor
public class UserJwtConverter implements Converter<Jwt, AbstractAuthenticationToken> {

    private final AppUserRepository users;

    @Override
    public AbstractAuthenticationToken convert(Jwt jwt) {
        AppUser user = users.findByUsernameIgnoreCase(jwt.getSubject())
                .filter(AppUser::isActive)
                .orElseThrow(() -> new InvalidBearerTokenException("User is unknown or disabled"));
        var authorities = List.of(new SimpleGrantedAuthority("ROLE_" + user.getRole().name()));
        return new JwtAuthenticationToken(jwt, authorities, user.getUsername());
    }
}
