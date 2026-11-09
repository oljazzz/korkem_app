package db.migration;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;

/**
 * Fills product.pack_amount / pack_unit from the size written in the product name:
 * mass ("20кг", "800гр") becomes KG, volume ("5Л", "500мл") becomes L. Names with more than one
 * size ("200мл + 50гр", "65л 870мл") are ambiguous and left for manual entry.
 */
public class V8__ExtractProductPacks extends BaseJavaMigration {

    static final Pattern SIZE = Pattern.compile("(?iu)(\\d+(?:[.,]\\d+)?)\\s*(кг|kg|гр|г|g|мл|ml|л|l)(?![\\p{L}])");

    /** Pack size in a base unit: amount and "KG" or "L". */
    record Pack(BigDecimal amount, String unit) {}

    @Override
    public void migrate(Context context) throws Exception {
        var conn = context.getConnection();
        try (Statement select = conn.createStatement();
             ResultSet rs = select.executeQuery("select id, name from product where pack_amount is null");
             PreparedStatement update = conn.prepareStatement("update product set pack_amount = ?, pack_unit = ? where id = ?")) {
            while (rs.next()) {
                Pack pack = packFrom(rs.getString("name"));
                if (pack != null) {
                    update.setBigDecimal(1, pack.amount());
                    update.setString(2, pack.unit());
                    update.setLong(3, rs.getLong("id"));
                    update.addBatch();
                }
            }
            update.executeBatch();
        }
    }

    /** The single size written in the name, or null when there is none or more than one. */
    static Pack packFrom(String name) {
        if (name == null) return null;
        List<Pack> found = new ArrayList<>();
        Matcher m = SIZE.matcher(name);
        while (m.find()) {
            BigDecimal value = new BigDecimal(m.group(1).replace(',', '.'));
            String unit = m.group(2).toLowerCase();
            boolean small = unit.startsWith("г") || unit.equals("g") || unit.startsWith("м") || unit.equals("ml");
            boolean volume = unit.startsWith("л") || unit.equals("l") || unit.startsWith("м") || unit.equals("ml");
            BigDecimal base = small ? value.divide(BigDecimal.valueOf(1000), 3, RoundingMode.HALF_UP) : value;
            found.add(new Pack(base.setScale(3, RoundingMode.HALF_UP), volume ? "L" : "KG"));
        }
        return found.size() == 1 && found.get(0).amount().signum() > 0 ? found.get(0) : null;
    }
}
