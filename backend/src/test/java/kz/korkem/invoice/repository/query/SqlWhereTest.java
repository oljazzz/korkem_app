package kz.korkem.invoice.repository.query;

import static org.assertj.core.api.Assertions.assertThat;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;

class SqlWhereTest {

    @Test
    void emptyWhenNothingFilters() {
        SqlWhere w = new SqlWhere()
                .eq("i.client_id", "clientId", null)
                .contains("lower(c.name) like :q", "q", "  ")
                .in("i.id", "ids", List.of());
        assertThat(w.sql()).isEmpty();
        assertThat(w.params().getParameterNames()).isEmpty();
    }

    @Test
    void joinsPresentConditionsInOrder() {
        SqlWhere w = new SqlWhere()
                .eq("i.number", "number", 7283L)
                .eq("i.client_id", "clientId", null)
                .in("i.id", "ids", List.of(1L, 2L))
                .and("v.id is not null");
        assertThat(w.sql()).isEqualTo(" where i.number = :number and i.id in (:ids) and v.id is not null");
        assertThat(w.params().getValue("number")).isEqualTo(7283L);
        assertThat(w.params().hasValue("clientId")).isFalse();
    }

    @Test
    void containsLowerCasesAndWraps() {
        SqlWhere w = new SqlWhere().contains("lower(c.name) like :q", "q", "Анар");
        assertThat(w.params().getValue("q")).isEqualTo("%анар%");
    }

    @Test
    void bindsInstantAsTimestampForPostgres() {
        Instant from = Instant.parse("2026-11-01T00:00:00Z");
        SqlWhere w = new SqlWhere().atLeast("i.created_at", "from", from).before("i.created_at", "to", null);
        assertThat(w.sql()).isEqualTo(" where i.created_at >= :from");
        assertThat(w.params().getValue("from")).isEqualTo(Timestamp.from(from));
    }
}
