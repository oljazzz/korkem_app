package kz.korkem.invoice.domain;

import java.util.Locale;
import java.util.Set;
import kz.korkem.invoice.exception.BadRequestException;

/** What a new password must be like. Checked on every password set; existing ones keep working. */
public final class PasswordPolicy {

    public static final int MIN_LENGTH = 10;
    public static final int MAX_LENGTH = 100;

    /** The most guessed passwords that pass the other rules. */
    private static final Set<String> COMMON = Set.of(
            "qwerty1234", "1234567890q", "q1234567890", "password1", "password12", "password123",
            "qwertyuiop1", "1q2w3e4r5t", "1qaz2wsx3edc", "zaq12wsxcde", "korkem2024", "korkem2025", "korkem2026",
            "admin12345", "administrator1", "parol12345", "kazakhstan1", "almaty2024", "almaty2025");

    private PasswordPolicy() {}

    /** Throws with the first rule {@code password} breaks; {@code username} is the account's login. */
    public static void check(String password, String username) {
        if (password == null || password.length() < MIN_LENGTH) {
            throw new BadRequestException("error.password.short", MIN_LENGTH);
        }
        if (password.length() > MAX_LENGTH) {
            throw new BadRequestException("error.password.long", MAX_LENGTH);
        }
        if (password.codePoints().noneMatch(Character::isLetter) || password.codePoints().noneMatch(Character::isDigit)) {
            throw new BadRequestException("error.password.lettersAndDigits");
        }
        String lower = password.toLowerCase(Locale.ROOT);
        String login = username == null ? "" : username.trim().toLowerCase(Locale.ROOT);
        if (login.length() >= 3 && lower.contains(login)) {
            throw new BadRequestException("error.password.containsUsername");
        }
        if (COMMON.contains(lower) || lower.chars().distinct().count() < 4) {
            throw new BadRequestException("error.password.common");
        }
    }
}
