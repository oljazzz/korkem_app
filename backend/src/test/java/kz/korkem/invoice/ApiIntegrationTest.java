package kz.korkem.invoice;

import static org.hamcrest.Matchers.*;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

@SpringBootTest
@ActiveProfiles("test")
class ApiIntegrationTest {

    @Autowired
    WebApplicationContext ctx;

    MockMvc mvc;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.webAppContextSetup(ctx).apply(springSecurity()).build();
    }

    private String login() throws Exception {
        String body = mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"admin\",\"password\":\"admin\"}"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return "Bearer " + extract(body, "token");
    }

    private static String extract(String json, String field) {
        Matcher m = Pattern.compile("\"" + field + "\"\\s*:\\s*\"?([^\",}]+)").matcher(json);
        if (!m.find()) throw new AssertionError(field + " not in " + json);
        return m.group(1);
    }

    @Test
    void rejectsAnonymousAndWrongPassword() throws Exception {
        mvc.perform(get("/api/clients")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"admin\",\"password\":\"wrong\"}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void fullInvoiceFlow() throws Exception {
        String auth = login();

        String cat = mvc.perform(post("/api/categories").header("Authorization", auth)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Эмаль\",\"sortOrder\":1}"))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        String catId = extract(cat, "id");

        String prod = mvc.perform(post("/api/products").header("Authorization", auth)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"categoryId\":" + catId + ",\"name\":\"646 растворитель 3.7л\",\"price\":3800}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.categoryName").value("Эмаль"))
                .andReturn().getResponse().getContentAsString();
        String prodId = extract(prod, "id");

        String client = mvc.perform(post("/api/clients").header("Authorization", auth)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"ип.Анар\",\"address\":\"Капчагай Алга рынок\"}"))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        String clientId = extract(client, "id");

        String inv = mvc.perform(post("/api/invoices").header("Authorization", auth)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"clientId\":" + clientId + ",\"lines\":[{\"productId\":" + prodId
                                + ",\"price\":3800,\"quantity\":4}]}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.number").value(greaterThan(0)))
                .andExpect(jsonPath("$.clientName").value("ип.Анар - Капчагай Алга рынок"))
                .andExpect(jsonPath("$.lines[0].total").value(15200.00))
                .andExpect(jsonPath("$.lines[0].vat").value(1628.57))
                .andExpect(jsonPath("$.lines[0].categoryName").value("Эмаль"))
                .andExpect(jsonPath("$.lines[0].unitLabel").value("Шт"))
                .andReturn().getResponse().getContentAsString();
        String invId = extract(inv, "id");

        mvc.perform(get("/api/invoices").param("q", "Анар").header("Authorization", auth))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(1))
                .andExpect(jsonPath("$.items[0].id").value(Integer.parseInt(invId)));

        String today = java.time.LocalDate.now(java.time.ZoneId.of("Asia/Almaty")).toString();
        mvc.perform(get("/api/reports/sales").param("from", today).param("to", today).header("Authorization", auth))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.invoiceCount").value(greaterThanOrEqualTo(1)))
                .andExpect(jsonPath("$.rows[?(@.productName == '646 растворитель 3.7л')].quantity").value(hasItem(4.0)))
                .andExpect(jsonPath("$.rows[?(@.productName == '646 растворитель 3.7л')].avgPrice").value(hasItem(3800.0)));
        mvc.perform(get("/api/reports/sales").param("invoiceIds", invId).header("Authorization", auth))
                .andExpect(jsonPath("$.invoiceCount").value(1))
                .andExpect(jsonPath("$.total").value(15200.0));
        mvc.perform(get("/api/reports/dashboard").param("from", today).param("to", today).header("Authorization", auth))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.granularity").value("day"))
                .andExpect(jsonPath("$.current.invoices").value(greaterThanOrEqualTo(1)))
                .andExpect(jsonPath("$.topClients[0].name").exists());
        mvc.perform(get("/api/reports/company").header("Authorization", auth))
                .andExpect(jsonPath("$.name").value("ТОО Körkem"));

        // Клиенттің накладнойы бар — жоюға болмайды
        mvc.perform(delete("/api/clients/" + clientId).header("Authorization", auth))
                .andExpect(status().isConflict());

        // Тауарды жоюға болады: накладнойда атауы сақталады
        mvc.perform(delete("/api/products/" + prodId).header("Authorization", auth))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/invoices/" + invId).header("Authorization", auth))
                .andExpect(jsonPath("$.lines[0].productName").value("646 растворитель 3.7л"))
                .andExpect(jsonPath("$.lines[0].productId").value(nullValue()));
    }

    @Test
    void validationErrors() throws Exception {
        String auth = login();
        mvc.perform(post("/api/products").header("Authorization", auth)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fields.name").exists())
                .andExpect(jsonPath("$.fields.price").exists());
    }
}
