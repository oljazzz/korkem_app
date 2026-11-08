package kz.korkem.invoice.security;

import kz.korkem.invoice.user.AppUser;
import kz.korkem.invoice.user.AppUserRepository;
import kz.korkem.invoice.user.Role;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

/** Creates the first ADMIN when the user table is empty. */
@Slf4j
@Component
public class AdminInitializer implements ApplicationRunner {

    private final AppUserRepository users;
    private final PasswordEncoder encoder;
    private final String username;
    private final String password;

    public AdminInitializer(AppUserRepository users, PasswordEncoder encoder,
                            @Value("${app.admin.username}") String username,
                            @Value("${app.admin.password}") String password) {
        this.users = users;
        this.encoder = encoder;
        this.username = username;
        this.password = password;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (users.count() > 0) {
            return;
        }
        AppUser admin = new AppUser();
        admin.setUsername(username);
        admin.setPasswordHash(encoder.encode(password));
        admin.setTimeZone("Asia/Almaty");
        admin.setRole(Role.ADMIN);
        admin.setActive(true);
        users.save(admin);
        log.info("Initial admin user created: {}", username);
    }
}
