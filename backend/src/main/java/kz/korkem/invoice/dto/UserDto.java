package kz.korkem.invoice.dto;

import kz.korkem.invoice.entities.AppUser;
import kz.korkem.invoice.enums.Role;

public record UserDto(Long id, String username, String firstName, String lastName, String email,
                      String timeZone, Role role, boolean active) {
    public static UserDto of(AppUser u) {
        return new UserDto(u.getId(), u.getUsername(), u.getFirstName(), u.getLastName(), u.getEmail(),
                u.getTimeZone(), u.getRole(), u.isActive());
    }
}
