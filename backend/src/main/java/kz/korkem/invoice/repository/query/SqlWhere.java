package kz.korkem.invoice.repository.query;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Locale;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;

/**
 * Builds a SQL "where" clause and its named parameters from optional filters, so a query reads as a list
 * of conditions instead of one {@code if} per filter.
 *
 * <p>A condition with a value is added only when the value is present: not null, not a blank string,
 * not an empty collection. {@link Instant} values are bound as {@link Timestamp}, which the PostgreSQL
 * driver understands.
 *
 * <pre>{@code
 * SqlWhere where = new SqlWhere()
 *         .eq("i.client_id", "clientId", clientId)
 *         .atLeast("i.created_at", "from", from)
 *         .before("i.created_at", "to", to);
 * jdbc.query("select … from invoice i" + where.sql(), where.params(), mapper);
 * }</pre>
 */
public final class SqlWhere {

    private final List<String> conditions = new ArrayList<>();
    private final MapSqlParameterSource params = new MapSqlParameterSource();

    /** {@code column = :name} when the value is present. */
    public SqlWhere eq(String column, String name, Object value) {
        return and(column + " = :" + name, name, value);
    }

    /** {@code column >= :name} when the value is present. */
    public SqlWhere atLeast(String column, String name, Object value) {
        return and(column + " >= :" + name, name, value);
    }

    /** {@code column < :name} when the value is present. */
    public SqlWhere before(String column, String name, Object value) {
        return and(column + " < :" + name, name, value);
    }

    /** {@code column in (:name)} when the collection is not empty. */
    public SqlWhere in(String column, String name, Collection<?> values) {
        return and(column + " in (:" + name + ")", name, values);
    }

    /**
     * A condition that uses {@code :name} in a case-insensitive {@code like}: the text is lower-cased and
     * wrapped in {@code %…%}. Skipped when the text is blank.
     */
    public SqlWhere contains(String condition, String name, String text) {
        return isPresent(text) ? and(condition, name, "%" + text.toLowerCase(Locale.ROOT) + "%") : this;
    }

    /** Any condition that uses {@code :name}; added when the value is present. */
    public SqlWhere and(String condition, String name, Object value) {
        if (!isPresent(value)) return this;
        conditions.add(condition);
        params.addValue(name, value instanceof Instant instant ? Timestamp.from(instant) : value);
        return this;
    }

    /** A condition without parameters, always added. */
    public SqlWhere and(String condition) {
        conditions.add(condition);
        return this;
    }

    /** A parameter used elsewhere in the query (e.g. in {@code limit}). */
    public SqlWhere param(String name, Object value) {
        params.addValue(name, value);
        return this;
    }

    /** {@code " where a and b"}, or an empty string when nothing filters. */
    public String sql() {
        return conditions.isEmpty() ? "" : " where " + String.join(" and ", conditions);
    }

    public MapSqlParameterSource params() {
        return params;
    }

    private static boolean isPresent(Object value) {
        return switch (value) {
            case null -> false;
            case String s -> !s.isBlank();
            case Collection<?> c -> !c.isEmpty();
            default -> true;
        };
    }
}
