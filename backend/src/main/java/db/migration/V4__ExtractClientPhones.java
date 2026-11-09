package db.migration;

import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;

/**
 * Copies Kazakhstan mobile numbers found in legacy client names and addresses into client.phone,
 * normalised as "+7 7XX XXX XX XX". Name and address are left unchanged.
 */
public class V4__ExtractClientPhones extends BaseJavaMigration {

    // Optional +7 / 8 prefix, a 7XX operator code, then 7 digits with optional spaces, dashes or brackets
    static final Pattern PHONE = Pattern.compile(
            "(?<!\\d)(?:\\+?7|8)?[\\s-]*\\(?(7\\d{2})\\)?[\\s-]*(\\d{3})[\\s-]*(\\d{2})[\\s-]*(\\d{2})(?!\\d)");

    @Override
    public void migrate(Context context) throws Exception {
        var conn = context.getConnection();
        try (Statement select = conn.createStatement();
             ResultSet rs = select.executeQuery("select id, name, address from client where phone is null");
             PreparedStatement update = conn.prepareStatement("update client set phone = ? where id = ?")) {
            while (rs.next()) {
                String phones = extract(rs.getString("name") + " " + rs.getString("address"));
                if (phones != null) {
                    update.setString(1, phones);
                    update.setLong(2, rs.getLong("id"));
                    update.addBatch();
                }
            }
            update.executeBatch();
        }
    }

    /** All distinct phone numbers in the text, comma separated, or null if there are none. */
    static String extract(String text) {
        Set<String> found = new LinkedHashSet<>();
        Matcher m = PHONE.matcher(text == null ? "" : text);
        while (m.find()) {
            found.add("+7 " + m.group(1) + " " + m.group(2) + " " + m.group(3) + " " + m.group(4));
        }
        String joined = String.join(", ", found);
        return joined.isEmpty() ? null : joined.length() > 100 ? joined.substring(0, 100) : joined;
    }
}
