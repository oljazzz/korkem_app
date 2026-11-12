package kz.korkem.invoice.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import kz.korkem.invoice.enums.Role;

/** Request and response bodies of users and login. */
public final class UserDtos {

    public static final int MIN_PASSWORD_LENGTH = 8;

    private UserDtos() {}

    public record UserDto(Long id, String username, String firstName, String lastName, String email,
                          String timeZone, Role role, boolean active) {}

    /** {@code password} is optional on update: blank keeps the old one. */
    public record UserRequest(
            @NotBlank(message = "{validation.username.required}") @Size(max = 100, message = "{validation.username.tooLong}") String username,
            String firstName, String lastName,
            @Email(message = "{validation.email.format}") String email,
            String timeZone,
            @NotNull(message = "{validation.role.required}") Role role,
            boolean active,
            @Size(min = MIN_PASSWORD_LENGTH, max = 100, message = "{validation.password.short}") String password) {}

    public record LoginRequest(@NotBlank String username, @NotBlank String password, Boolean remember) {}

    public record LoginResponse(Instant expiresAt, UserDto user) {}
}
