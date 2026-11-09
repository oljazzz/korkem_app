package kz.korkem.invoice;

import static org.hamcrest.Matchers.*;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.time.LocalDate;
import java.time.ZoneId;
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
        return login("admin", "admin");
    }

    private String login(String username, String password) throws Exception {
        String setCookie = mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"" + username + "\",\"password\":\"" + password + "\"}"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getHeader("Set-Cookie");
        return "Bearer " + cookieValue(setCookie);
    }

    private static String cookieValue(String setCookie) {
        return setCookie.substring(setCookie.indexOf('=') + 1, setCookie.indexOf(';'));
    }

    private String createUser(String admin, String username, String role) throws Exception {
        String body = mvc.perform(post("/api/users").header("Authorization", admin).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"" + username + "\",\"password\":\"secret-123\",\"role\":\"" + role
                                + "\",\"active\":true}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.role").value(role))
                .andReturn().getResponse().getContentAsString();
        return extract(body, "id");
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
                .andExpect(jsonPath("$.lines[0].unitLabel").value("дана"))
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
        mvc.perform(get("/api/settings").header("Authorization", auth))
                .andExpect(jsonPath("$.company.name").value("Körkem ЖШС"))
                .andExpect(jsonPath("$.vatRate").value(12));

        mvc.perform(get("/api/invoices").param("from", today).param("to", today).header("Authorization", auth))
                .andExpect(jsonPath("$.items[?(@.id == " + invId + ")]").exists());
        String yesterday = java.time.LocalDate.now(java.time.ZoneId.of("Asia/Almaty")).minusDays(1).toString();
        mvc.perform(get("/api/invoices").param("to", yesterday).header("Authorization", auth))
                .andExpect(jsonPath("$.items[?(@.id == " + invId + ")]").doesNotExist());

        // A client with invoices cannot be deleted
        mvc.perform(delete("/api/clients/" + clientId).header("Authorization", auth))
                .andExpect(status().isConflict());

        // Deleting a product keeps its name on existing invoices
        mvc.perform(delete("/api/products/" + prodId).header("Authorization", auth))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/invoices/" + invId).header("Authorization", auth))
                .andExpect(jsonPath("$.lines[0].productName").value("646 растворитель 3.7л"))
                .andExpect(jsonPath("$.lines[0].productId").value(nullValue()));
    }

    @Test
    void validationErrors() throws Exception {
        String auth = login();
        mvc.perform(post("/api/invoices").header("Authorization", auth)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"clientId\":null,\"lines\":[]}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fields.clientId").exists())
                .andExpect(jsonPath("$.fields.lines").exists());
        mvc.perform(post("/api/products").header("Authorization", auth)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fields.name").exists())
                .andExpect(jsonPath("$.fields.price").exists());
    }

    @Test
    void invoiceDateCanBeBackdatedButNotFuture() throws Exception {
        String auth = login();
        String clientId = extract(mvc.perform(post("/api/clients").header("Authorization", auth)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Күн клиенті\"}"))
                .andReturn().getResponse().getContentAsString(), "id");
        LocalDate today = LocalDate.now(ZoneId.of("Asia/Almaty"));
        String lines = ",\"lines\":[{\"productName\":\"Бояу\",\"price\":100,\"quantity\":1}]}";

        // Backdated on create: noon of that day in Almaty (07:00 UTC)
        String inv = mvc.perform(post("/api/invoices").header("Authorization", auth)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"clientId\":" + clientId + ",\"date\":\"" + today.minusDays(3) + "\"" + lines))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.createdAt").value(startsWith(today.minusDays(3) + "T07:00")))
                .andReturn().getResponse().getContentAsString();
        String invId = extract(inv, "id");

        // Changed on update
        mvc.perform(put("/api/invoices/" + invId).header("Authorization", auth)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"clientId\":" + clientId + ",\"date\":\"" + today.minusDays(10) + "\"" + lines))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.createdAt").value(startsWith(today.minusDays(10).toString())));

        // Future dates are rejected
        mvc.perform(put("/api/invoices/" + invId).header("Authorization", auth)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"clientId\":" + clientId + ",\"date\":\"" + today.plusDays(1) + "\"" + lines))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Жүкқұжат күні болашақта болмауы керек"));
    }

    @Test
    void managerRoleIsRestricted() throws Exception {
        String admin = login();
        createUser(admin, "manager1", "MANAGER");
        String manager = login("manager1", "secret-123");

        mvc.perform(get("/api/auth/me").header("Authorization", manager))
                .andExpect(jsonPath("$.role").value("MANAGER"));
        mvc.perform(get("/api/users").header("Authorization", manager))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").exists());

        String client = mvc.perform(post("/api/clients").header("Authorization", manager)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Менеджер клиенті\"}"))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        String clientId = extract(client, "id");
        String inv = mvc.perform(post("/api/invoices").header("Authorization", manager)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"clientId\":" + clientId + ",\"lines\":[{\"productName\":\"Бояу\",\"price\":1000,\"quantity\":2}]}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.createdBy").value("manager1"))
                .andReturn().getResponse().getContentAsString();

        mvc.perform(delete("/api/invoices/" + extract(inv, "id")).header("Authorization", manager))
                .andExpect(status().isForbidden());
        mvc.perform(delete("/api/clients/" + clientId).header("Authorization", manager))
                .andExpect(status().isForbidden());
    }

    @Test
    void deactivatedUserTokenStopsWorking() throws Exception {
        String admin = login();
        String id = createUser(admin, "temp1", "MANAGER");
        String temp = login("temp1", "secret-123");
        mvc.perform(get("/api/clients").header("Authorization", temp)).andExpect(status().isOk());

        mvc.perform(put("/api/users/" + id).header("Authorization", admin).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"temp1\",\"role\":\"MANAGER\",\"active\":false}"))
                .andExpect(status().isOk());
        mvc.perform(get("/api/clients").header("Authorization", temp)).andExpect(status().isUnauthorized());
    }

    @Test
    void cannotRemoveLastAdminOrUseWeakPassword() throws Exception {
        String admin = login();
        String me = mvc.perform(get("/api/auth/me").header("Authorization", admin))
                .andReturn().getResponse().getContentAsString();
        mvc.perform(put("/api/users/" + extract(me, "id")).header("Authorization", admin).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"admin\",\"role\":\"MANAGER\",\"active\":true}"))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/users").header("Authorization", admin).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"weak\",\"password\":\"123\",\"role\":\"MANAGER\",\"active\":true}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fields.password").exists());
    }

    @Test
    void authCookieIsHttpOnlyAndWorksAlone() throws Exception {
        var res = mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"admin\",\"password\":\"admin\",\"remember\":true}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").doesNotExist())
                .andReturn().getResponse();
        String setCookie = res.getHeader("Set-Cookie");
        org.junit.jupiter.api.Assertions.assertTrue(setCookie.contains("HttpOnly"), setCookie);
        org.junit.jupiter.api.Assertions.assertTrue(setCookie.contains("SameSite=Strict"), setCookie);
        org.junit.jupiter.api.Assertions.assertTrue(setCookie.contains("Max-Age="), setCookie);

        var cookie = new jakarta.servlet.http.Cookie("korkem_token", cookieValue(setCookie));
        mvc.perform(get("/api/auth/me").cookie(cookie)).andExpect(status().isOk());

        // A stale cookie does not block signing in again
        var stale = new jakarta.servlet.http.Cookie("korkem_token", "garbage");
        mvc.perform(post("/api/auth/login").cookie(stale).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"admin\",\"password\":\"admin\"}"))
                .andExpect(status().isOk());

        String cleared = mvc.perform(post("/api/auth/logout").cookie(cookie))
                .andExpect(status().isNoContent()).andReturn().getResponse().getHeader("Set-Cookie");
        org.junit.jupiter.api.Assertions.assertTrue(cleared.contains("Max-Age=0"), cleared);
    }

    @Test
    void repeatedFailedLoginsAreThrottled() throws Exception {
        String admin = login();
        createUser(admin, "victim1", "MANAGER");
        for (int i = 0; i < 5; i++) {
            mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                            .content("{\"username\":\"victim1\",\"password\":\"wrong-pass\"}"))
                    .andExpect(status().isUnauthorized());
        }
        // Even the correct password is refused while blocked
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"victim1\",\"password\":\"secret-123\"}"))
                .andExpect(status().isTooManyRequests())
                .andExpect(header().exists("Retry-After"));
    }

    private String json(String auth, org.springframework.test.web.servlet.RequestBuilder req, int status) throws Exception {
        return mvc.perform(req).andExpect(status().is(status)).andReturn().getResponse().getContentAsString();
    }

    private String createInvoice(String auth, String clientId, int price, int qty) throws Exception {
        return mvc.perform(post("/api/invoices").header("Authorization", auth).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"clientId\":" + clientId + ",\"lines\":[{\"productName\":\"Тауар\",\"price\":" + price
                                + ",\"quantity\":" + qty + "}]}"))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
    }

    @Test
    void clientCardShowsHistoryDebtAndLastInvoice() throws Exception {
        String auth = login();
        String client = mvc.perform(post("/api/clients").header("Authorization", auth).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"ип.Карта\",\"phone\":\"+7 701 111 22 33\",\"city\":\"Узынагаш\",\"openingDebt\":5000}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.debt").value(5000))
                .andReturn().getResponse().getContentAsString();
        String clientId = extract(client, "id");

        // Search by phone digits regardless of spacing
        mvc.perform(get("/api/clients").param("q", "7011112233").header("Authorization", auth))
                .andExpect(jsonPath("$.items[0].id").value(Integer.parseInt(clientId)));

        createInvoice(auth, clientId, 1000, 2);
        String last = createInvoice(auth, clientId, 500, 3);

        mvc.perform(get("/api/clients/" + clientId + "/summary").header("Authorization", auth))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.invoiceCount").value(2))
                .andExpect(jsonPath("$.total").value(3500))
                .andExpect(jsonPath("$.client.debt").value(8500))
                .andExpect(jsonPath("$.recentInvoices.length()").value(2))
                .andExpect(jsonPath("$.recentInvoices[0].status").value("UNPAID"))
                .andExpect(jsonPath("$.topProducts[0].name").value("Тауар"));

        mvc.perform(get("/api/clients/" + clientId + "/last-invoice").header("Authorization", auth))
                .andExpect(jsonPath("$.id").value(Integer.parseInt(extract(last, "id"))))
                .andExpect(jsonPath("$.lines[0].quantity").value(3));

        mvc.perform(get("/api/clients/debtors").header("Authorization", auth))
                .andExpect(jsonPath("$.debtors[?(@.client.id == " + clientId + ")].debt").value(contains(8500.0)));
    }

    @Test
    void paymentsTrackWhatIsOwed() throws Exception {
        String admin = login();
        String clientId = extract(mvc.perform(post("/api/clients").header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Төлем клиенті\"}"))
                .andReturn().getResponse().getContentAsString(), "id");
        String invId = extract(createInvoice(admin, clientId, 1000, 10), "id");

        // Partial payment
        String pay = mvc.perform(post("/api/invoices/" + invId + "/payments").header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"amount\":4000,\"method\":\"TRANSFER\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.methodLabel").value("Аударым"))
                .andReturn().getResponse().getContentAsString();
        mvc.perform(get("/api/invoices/" + invId).header("Authorization", admin))
                .andExpect(jsonPath("$.status").value("PARTIAL"))
                .andExpect(jsonPath("$.paid").value(4000))
                .andExpect(jsonPath("$.due").value(6000));
        mvc.perform(get("/api/invoices").param("dueOnly", "true").param("clientId", clientId).header("Authorization", admin))
                .andExpect(jsonPath("$.items.length()").value(1));

        // Overpayment, total below what was paid, and deleting a paid invoice are refused
        mvc.perform(post("/api/invoices/" + invId + "/payments").header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"amount\":6000.01}"))
                .andExpect(status().isBadRequest());
        mvc.perform(put("/api/invoices/" + invId).header("Authorization", admin).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"clientId\":" + clientId + ",\"lines\":[{\"productName\":\"Тауар\",\"price\":100,\"quantity\":1}]}"))
                .andExpect(status().isBadRequest());
        mvc.perform(delete("/api/invoices/" + invId).header("Authorization", admin))
                .andExpect(status().isBadRequest());

        // Paying the rest settles it
        mvc.perform(post("/api/invoices/" + invId + "/payments").header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"amount\":6000}"))
                .andExpect(status().isCreated());
        mvc.perform(get("/api/invoices/" + invId).header("Authorization", admin))
                .andExpect(jsonPath("$.status").value("PAID"))
                .andExpect(jsonPath("$.due").value(0));
        mvc.perform(get("/api/invoices").param("dueOnly", "true").param("clientId", clientId).header("Authorization", admin))
                .andExpect(jsonPath("$.items.length()").value(0));

        // Only admins delete payments
        createUser(admin, "cashier1", "MANAGER");
        String manager = login("cashier1", "secret-123");
        mvc.perform(delete("/api/payments/" + extract(pay, "id")).header("Authorization", manager))
                .andExpect(status().isForbidden());
        mvc.perform(delete("/api/payments/" + extract(pay, "id")).header("Authorization", admin))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/invoices/" + invId + "/payments").header("Authorization", admin))
                .andExpect(jsonPath("$.length()").value(1));
    }

    @Test
    void companySettingsAreEditableByAdminsOnly() throws Exception {
        String admin = login();
        createUser(admin, "clerk1", "MANAGER");
        String manager = login("clerk1", "secret-123");
        String body = "{\"name\":\"Körkem ЖШС\",\"bin\":\"123456789012\",\"address\":\"Алматы\",\"phone\":\"+7 701 000 00 00\","
                + "\"chiefAccountant\":\"Бухгалтер А.\",\"releaseAllowedBy\":\"Директор Б.\"}";

        mvc.perform(put("/api/settings/company").header("Authorization", manager)
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isForbidden());
        mvc.perform(put("/api/settings/company").header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON).content(body.replace("123456789012", "12345")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fields.bin").exists());
        mvc.perform(put("/api/settings/company").header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk());
        mvc.perform(get("/api/settings").header("Authorization", manager))
                .andExpect(jsonPath("$.company.bin").value("123456789012"))
                .andExpect(jsonPath("$.company.releaseAllowedBy").value("Директор Б."));
    }

    @Test
    void mergeKeepsTheClientWithTheNewestInvoice() throws Exception {
        String admin = login();
        String older = extract(mvc.perform(post("/api/clients").header("Authorization", admin).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"ип.Берик\",\"phone\":\"+7 705 189 91 49\",\"city\":\"Капчагай\",\"openingDebt\":1000}"))
                .andReturn().getResponse().getContentAsString(), "id");
        String newer = extract(mvc.perform(post("/api/clients").header("Authorization", admin).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"ип.Берик Алга\",\"phone\":\"87051899149, +7 701 000 11 22\",\"openingDebt\":500}"))
                .andReturn().getResponse().getContentAsString(), "id");
        LocalDate today = LocalDate.now(ZoneId.of("Asia/Almaty"));
        String lines = ",\"lines\":[{\"productName\":\"Бояу\",\"price\":100,\"quantity\":1}]}";
        // The record created first has the newer invoice, so it must win regardless of id order
        mvc.perform(post("/api/invoices").header("Authorization", admin).contentType(MediaType.APPLICATION_JSON)
                .content("{\"clientId\":" + newer + ",\"date\":\"" + today.minusDays(30) + "\"" + lines)).andExpect(status().isCreated());
        mvc.perform(post("/api/invoices").header("Authorization", admin).contentType(MediaType.APPLICATION_JSON)
                .content("{\"clientId\":" + newer + ",\"date\":\"" + today.minusDays(20) + "\"" + lines)).andExpect(status().isCreated());
        mvc.perform(post("/api/invoices").header("Authorization", admin).contentType(MediaType.APPLICATION_JSON)
                .content("{\"clientId\":" + older + lines)).andExpect(status().isCreated());

        mvc.perform(get("/api/clients/duplicates").header("Authorization", admin))
                .andExpect(jsonPath("$[?(@[0].client.id == " + older + " && @[1].client.id == " + newer + ")]").exists());
        mvc.perform(get("/api/clients/merge-plan").param("clientId", newer).param("otherId", older).header("Authorization", admin))
                .andExpect(jsonPath("$.primary.client.id").value(Integer.parseInt(older)))
                .andExpect(jsonPath("$.secondary.invoiceCount").value(2));
        mvc.perform(get("/api/clients/merge-plan").param("clientId", older).param("otherId", older).header("Authorization", admin))
                .andExpect(status().isBadRequest());

        createUser(admin, "merger1", "MANAGER");
        String manager = login("merger1", "secret-123");
        String body = "{\"clientId\":" + newer + ",\"otherId\":" + older + "}";
        mvc.perform(post("/api/clients/merge").header("Authorization", manager).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/clients/merge").header("Authorization", admin).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.primary.id").value(Integer.parseInt(older)))
                .andExpect(jsonPath("$.movedInvoices").value(2))
                .andExpect(jsonPath("$.removedName").value("ип.Берик Алга"))
                .andExpect(jsonPath("$.primary.name").value("ип.Берик"))
                .andExpect(jsonPath("$.primary.phone").value("+7 705 189 91 49, +7 701 000 11 22"))
                .andExpect(jsonPath("$.primary.city").value("Капчагай"))
                .andExpect(jsonPath("$.primary.openingDebt").value(1500))
                .andExpect(jsonPath("$.primary.debt").value(1800));
        mvc.perform(get("/api/clients/" + newer).header("Authorization", admin)).andExpect(status().isNotFound());
        mvc.perform(get("/api/clients/" + older + "/summary").header("Authorization", admin))
                .andExpect(jsonPath("$.invoiceCount").value(3));
    }
}
