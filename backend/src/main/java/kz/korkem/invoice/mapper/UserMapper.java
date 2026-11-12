package kz.korkem.invoice.mapper;

import kz.korkem.invoice.dto.UserDtos.UserDto;
import kz.korkem.invoice.entities.AppUser;
import org.springframework.stereotype.Component;

@Component
public class UserMapper {

    public UserDto toDto(AppUser u) {
        return new UserDto(u.getId(), u.getUsername(), u.getFirstName(), u.getLastName(), u.getEmail(),
                u.getTimeZone(), u.getRole(), u.isActive());
    }
}
