package kz.korkem.invoice.controller;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.security.Principal;
import java.time.Duration;
import kz.korkem.invoice.dto.UserDtos.LoginRequest;
import kz.korkem.invoice.dto.UserDtos.LoginResponse;
import kz.korkem.invoice.dto.UserDtos.UserDto;
import kz.korkem.invoice.properties.AuthProperties;
import kz.korkem.invoice.service.AuthService;
import kz.korkem.invoice.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * Login issues the JWT as an httpOnly, SameSite=Strict cookie: page scripts can never read it,
 * and the browser does not send it on cross-site requests (CSRF protection).
 */
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService auth;
    private final UserService users;
    private final AuthProperties authProps;

    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(@Valid @RequestBody LoginRequest req, HttpServletRequest http) {
        AuthService.Login login = auth.login(req.username(), req.password(), http.getRemoteAddr());
        // "Remember me" keeps the cookie until the token expires; otherwise it ends with the browser session
        Duration maxAge = Boolean.TRUE.equals(req.remember())
                ? Duration.between(login.issuedAt(), login.expiresAt()) : null;
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, cookie(login.token(), maxAge).toString())
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .body(new LoginResponse(login.expiresAt(), login.user()));
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout() {
        return ResponseEntity.noContent()
                .header(HttpHeaders.SET_COOKIE, cookie("", Duration.ZERO).toString())
                .build();
    }

    @GetMapping("/me")
    public UserDto me(Principal principal) {
        return users.byUsername(principal.getName());
    }

    private ResponseCookie cookie(String value, Duration maxAge) {
        ResponseCookie.ResponseCookieBuilder b = ResponseCookie.from(authProps.cookie().name(), value)
                .httpOnly(true)
                .secure(authProps.cookie().secure())
                .sameSite("Strict")
                .path("/api");
        if (maxAge != null) {
            b.maxAge(maxAge);
        }
        return b.build();
    }
}
