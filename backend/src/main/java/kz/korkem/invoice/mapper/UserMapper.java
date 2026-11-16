package kz.korkem.invoice.mapper;

import kz.korkem.invoice.dto.UserDtos.UserDto;
import kz.korkem.invoice.entities.AppUser;
import kz.korkem.invoice.util.Snapshot;
import org.springframework.stereotype.Component;

@Component
public class UserMapper {

    public UserDto toDto(AppUser u) {
        return new UserDto(u.getId(), u.getUsername(), u.getFirstName(), u.getLastName(), u.getEmail(),
                u.getTimeZone(), u.getRole(), u.isActive(), u.isMustChangePassword());
    }

    /** Never the password hash; a new password shows up only as the "password" field changing. */
    public Snapshot audit(AppUser u) {
        return Snapshot.of()
                .put("username", u.getUsername())
                .put("firstName", u.getFirstName())
                .put("lastName", u.getLastName())
                .put("email", u.getEmail())
                .put("timeZone", u.getTimeZone())
                .put("role", u.getRole())
                .put("active", u.isActive())
                .put("mustChangePassword", u.isMustChangePassword());
    }
}
