package kz.korkem.invoice.util;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import org.dhatim.fastexcel.BorderStyle;
import org.dhatim.fastexcel.Workbook;
import org.dhatim.fastexcel.Worksheet;

/**
 * One table as an .xlsx workbook: a title, an optional subtitle, a header row, the rows and an optional
 * totals row. Cells keep their types (numbers stay numbers, dates stay dates), so the file can be summed
 * and filtered in Excel. Text is stored as text, never as a formula.
 */
public final class XlsxTable {

    public enum Kind {
        TEXT("@"), INT("#,##0"), NUMBER("General"), MONEY("#,##0.00"), DATE("dd.mm.yyyy"),
        /** A number that names something (an invoice number): no thousands separator. */
        ID("0");

        private final String format;

        Kind(String format) {
            this.format = format;
        }
    }

    public record Column(String title, Kind kind, double width) {}

    private static final int HEADER_ROW = 3;
    private static final String HEADER_FILL = "E8EEE4";

    private final String sheet;
    private final String title;
    private final List<Column> columns;
    private final List<Object[]> rows = new ArrayList<>();
    private String subtitle;
    private Object[] totals;

    /** {@code sheet}: the tab's name (Excel allows 31 characters). */
    public XlsxTable(String sheet, String title, List<Column> columns) {
        this.sheet = sheet.length() > 31 ? sheet.substring(0, 31) : sheet;
        this.title = title;
        this.columns = columns;
    }

    public XlsxTable subtitle(String subtitle) {
        this.subtitle = subtitle;
        return this;
    }

    /** One value per column; null leaves the cell empty. */
    public XlsxTable row(Object... values) {
        rows.add(values);
        return this;
    }

    public XlsxTable totals(Object... values) {
        this.totals = values;
        return this;
    }

    public int size() {
        return rows.size();
    }

    public byte[] toBytes() {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try {
            Workbook wb = new Workbook(out, "Korkem", "1.0");
            Worksheet ws = wb.newWorksheet(sheet);
            int last = columns.size() - 1;

            ws.value(0, 0, title);
            ws.style(0, 0).bold().fontSize(14).set();
            if (subtitle != null) ws.value(1, 0, subtitle);

            for (int c = 0; c <= last; c++) {
                Column col = columns.get(c);
                ws.width(c, col.width());
                ws.value(HEADER_ROW, c, col.title());
            }
            ws.range(HEADER_ROW, 0, HEADER_ROW, last).style().bold().fillColor(HEADER_FILL).wrapText(true)
                    .verticalAlignment("center").borderStyle(BorderStyle.THIN).set();

            int r = HEADER_ROW + 1;
            for (Object[] row : rows) {
                write(ws, r++, row, false);
            }
            if (totals != null) {
                write(ws, r, totals, true);
            }
            ws.freezePane(0, HEADER_ROW + 1);
            if (!rows.isEmpty()) ws.setAutoFilter(HEADER_ROW, 0, last);
            wb.finish();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
        return out.toByteArray();
    }

    private void write(Worksheet ws, int r, Object[] values, boolean total) {
        for (int c = 0; c < columns.size(); c++) {
            Object v = c < values.length ? values[c] : null;
            switch (v) {
                case null -> { }
                case BigDecimal d -> ws.value(r, c, d);
                case Number n -> ws.value(r, c, n);
                case LocalDate d -> ws.value(r, c, d);
                default -> ws.value(r, c, v.toString());
            }
            var style = ws.style(r, c).format(columns.get(c).kind().format);
            if (total) style.bold().borderStyle(org.dhatim.fastexcel.BorderSide.TOP, BorderStyle.THIN);
            style.set();
        }
    }
}
