package kz.korkem.invoice.security;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import java.security.Principal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import kz.korkem.invoice.common.NotFoundException;
import kz.korkem.invoice.user.AppUserRepository;
import kz.korkem.invoice.user.UserDto;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    public record LoginRequest(@NotBlank String username, @NotBlank String password) {}

    public record LoginResponse(String token, Instant expiresAt, UserDto user) {}

    private final AuthenticationManager authManager;
    private final JwtEncoder encoder;
    private final JwtProperties props;
    private final AppUserRepository users;

    public AuthController(AuthenticationManager authManager, JwtEncoder encoder, JwtProperties props,
                          AppUserRepository users) {
        this.authManager = authManager;
        this.encoder = encoder;
        this.props = props;
        this.users = users;
    }

    @PostMapping("/login")
    public LoginResponse login(@Valid @RequestBody LoginRequest req) {
        Authentication auth = authManager.authenticate(
                UsernamePasswordAuthenticationToken.unauthenticated(req.username().trim(), req.password()));
        Instant now = Instant.now();
        Instant exp = now.plus(props.ttlHours(), ChronoUnit.HOURS);
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer("korkem-invoice")
                .subject(auth.getName())
                .issuedAt(now)
                .expiresAt(exp)
                .build();
        String token = encoder.encode(JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).build(), claims))
                .getTokenValue();
        return new LoginResponse(token, exp, me(auth::getName));
    }

    @GetMapping("/me")
    public UserDto me(Principal principal) {
        return users.findByUsernameIgnoreCase(principal.getName())
                .map(UserDto::of)
                .orElseThrow(() -> new NotFoundException("Пайдаланушы табылмады"));
    }
}
