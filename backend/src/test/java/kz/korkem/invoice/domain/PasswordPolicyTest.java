package kz.korkem.invoice.domain;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import kz.korkem.invoice.exception.BadRequestException;
import org.junit.jupiter.api.Test;

class PasswordPolicyTest {

    @Test
    void acceptsLongPasswordsWithLettersAndDigits() {
        assertDoesNotThrow(() -> PasswordPolicy.check("тау-бұлақ-2026", "aigerim"));
        assertDoesNotThrow(() -> PasswordPolicy.check("blue7horse", "aigerim"));
    }

    @Test
    void rejectsWeakPasswords() {
        assertEquals("error.password.short", rule("abc12345", "x"));
        assertEquals("error.password.lettersAndDigits", rule("onlyletters", "x"));
        assertEquals("error.password.lettersAndDigits", rule("1234567890", "x"));
        assertEquals("error.password.containsUsername", rule("Aigerim-2026", "aigerim"));
        assertEquals("error.password.common", rule("Password123", "x"));
        assertEquals("error.password.common", rule("a1a1a1a1a1a1", "x"));
    }

    private static String rule(String password, String username) {
        return assertThrows(BadRequestException.class, () -> PasswordPolicy.check(password, username)).getMessage();
    }
}
