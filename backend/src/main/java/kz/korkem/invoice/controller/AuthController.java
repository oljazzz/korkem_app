package kz.korkem.invoice.controller;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.security.Principal;
import kz.korkem.invoice.dto.UserDtos.LoginRequest;
import kz.korkem.invoice.dto.UserDtos.LoginResponse;
import kz.korkem.invoice.dto.UserDtos.PasswordChangeRequest;
import kz.korkem.invoice.dto.UserDtos.UserDto;
import kz.korkem.invoice.security.SessionCookie;
import kz.korkem.invoice.service.AuthService;
import kz.korkem.invoice.service.TokenService;
import kz.korkem.invoice.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.bind.annotation.*;

/** Sign-in and sign-out, and a user's own password. The session token travels in {@link SessionCookie}. */
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService auth;
    private final UserService users;
    private final SessionCookie cookie;

    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(@Valid @RequestBody LoginRequest req, HttpServletRequest http) {
        return started(auth.login(req.username(), req.password(), Boolean.TRUE.equals(req.remember()), http.getRemoteAddr()));
    }

    /** Ends this browser's session only; the token itself stays valid until it expires (see logout-all). */
    @PostMapping("/logout")
    public ResponseEntity<Void> logout() {
        return ResponseEntity.noContent().header(HttpHeaders.SET_COOKIE, cookie.clear()).build();
    }

    /** Ends every session of the current user, on all devices. */
    @PostMapping("/logout-all")
    public ResponseEntity<Void> logoutAll(Principal principal) {
        auth.signOutEverywhere(principal.getName());
        return ResponseEntity.noContent().header(HttpHeaders.SET_COOKIE, cookie.clear()).build();
    }

    /** Changes the current user's password; other sessions end, this one continues with a new token. */
    @PostMapping("/password")
    public ResponseEntity<LoginResponse> changePassword(@Valid @RequestBody PasswordChangeRequest req,
                                                        JwtAuthenticationToken principal, HttpServletRequest http) {
        boolean remember = Boolean.TRUE.equals(principal.getToken().getClaimAsBoolean(TokenService.REMEMBER));
        return started(auth.changePassword(principal.getName(), req.currentPassword(), req.newPassword(), remember,
                http.getRemoteAddr()));
    }

    @GetMapping("/me")
    public UserDto me(Principal principal) {
        return users.byUsername(principal.getName());
    }

    private ResponseEntity<LoginResponse> started(AuthService.Login login) {
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, cookie.set(login.session()))
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .body(new LoginResponse(login.session().expiresAt(), login.user()));
    }
}
