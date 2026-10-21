package com.mealplanner.server.product;

import com.mealplanner.server.TestcontainersConfiguration;
import com.mealplanner.server.auth.JwtService;
import com.mealplanner.server.config.LocaleConfig;
import com.mealplanner.server.user.User;
import com.mealplanner.server.user.UserRepository;
import com.mealplanner.server.user.UserRole;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.MessageSource;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import tools.jackson.databind.ObjectMapper;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class ProductMeasuresIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private MessageSource messageSource;

    @Autowired
    private ObjectMapper objectMapper;

    private User saveUser(UserRole role) {
        User user = new User();
        user.setEmail("user-" + UUID.randomUUID() + "@example.com");
        user.setPasswordHash("hash");
        user.setRole(role);
        return userRepository.save(user);
    }

    private ResultActions perform(User user, MockHttpServletRequestBuilder request) throws Exception {
        return mockMvc.perform(request.header(HttpHeaders.AUTHORIZATION,
                "Bearer " + jwtService.generateToken(user.getId(), user.getEmail())));
    }

    private static String body(String name, String unit, String measures) {
        return "{\"name\":\"" + name + "\",\"kcal\":89,\"protein\":1.1,\"fat\":0.3,\"carbs\":23,\"unit\":\"" + unit + "\""
                + (measures == null ? "" : ",\"measures\":" + measures) + "}";
    }

    private ResultActions create(User user, String unit, String measures) throws Exception {
        return perform(user, post("/api/products").contentType(MediaType.APPLICATION_JSON)
                .content(body("Banana " + UUID.randomUUID(), unit, measures)));
    }

    private UUID createdId(User user, String unit, String measures) throws Exception {
        String response = create(user, unit, measures).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return UUID.fromString(objectMapper.readTree(response).get("id").asString());
    }

    @Test
    void returnsOwnMeasuresStartingWithTheDefaultOneAndTheBaseUnitLast() throws Exception {
        create(saveUser(UserRole.USER), "100g", "[{\"code\":\"package\",\"base_amount\":450},"
                + "{\"code\":\"piece\",\"base_amount\":120.04,\"default\":true},{\"code\":\"g\",\"default\":false}]")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.measures[*].code", contains("piece", "package", "g")))
                .andExpect(jsonPath("$.measures[*].default", contains(true, false, false)))
                .andExpect(jsonPath("$.measures[*].base_amount", contains(120.0, 450.0, 1.0)))
                .andExpect(jsonPath("$.measures[*].max_amount", contains(100.0, 100.0, 5000.0)))
                .andExpect(jsonPath("$.measures[0].names.pl.few").value("sztuki"))
                .andExpect(jsonPath("$.measures[0].names.en.other").value("pieces"))
                .andExpect(jsonPath("$.measures[2].names").doesNotExist());
    }

    @Test
    void makesTheBaseUnitDefaultWhenNoOtherMeasureIs() throws Exception {
        create(saveUser(UserRole.USER), "100ml", "[{\"code\":\"cup\",\"base_amount\":250}]")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.measures[*].code", contains("ml", "cup")))
                .andExpect(jsonPath("$.measures[*].default", contains(true, false)))
                .andExpect(jsonPath("$.measures[1].max_amount").value(50.0));
        create(saveUser(UserRole.USER), "100g", null)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.measures[*].code", contains("g")));
    }

    @Test
    void countsPerPieceProductsOnlyInPieces() throws Exception {
        create(saveUser(UserRole.USER), "pc", "[{\"code\":\"package\",\"base_amount\":500,\"default\":true}]")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.measures[*].code", contains("piece")))
                .andExpect(jsonPath("$.measures[*].base_amount", contains(1.0)))
                .andExpect(jsonPath("$.measures[*].default", contains(true)));
    }

    @Test
    void rejectsInvalidMeasures() throws Exception {
        User user = saveUser(UserRole.USER);
        long before = productRepository.count();
        List<String> invalid = List.of(
                "[{\"code\":\"handful\",\"base_amount\":30}]",
                "[{\"base_amount\":30}]",
                "[null]",
                "[{\"code\":\"piece\",\"base_amount\":120},{\"code\":\"piece\",\"base_amount\":130}]",
                "[{\"code\":\"piece\",\"base_amount\":120,\"default\":true},{\"code\":\"g\",\"default\":true}]",
                "[{\"code\":\"piece\",\"base_amount\":0}]",
                "[{\"code\":\"piece\",\"base_amount\":0.04}]",
                "[{\"code\":\"piece\"}]",
                "[{\"code\":\"piece\",\"base_amount\":5001}]",
                "[{\"code\":\"package\",\"base_amount\":50001}]");

        for (String measures : invalid) {
            create(user, "100g", measures)
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error").value(messageSource.getMessage(
                            ProductService.MEASURE_INVALID, null, LocaleConfig.DEFAULT_LOCALE)));
        }

        create(user, "100g", "[{\"code\":\"package\",\"base_amount\":50000}]").andExpect(status().isOk());
        assertThat(productRepository.count()).isEqualTo(before + 1);
    }

    @Test
    void updatesMeasuresInPlaceAndKeepsThemWhenTheyAreLeftOut() throws Exception {
        User user = saveUser(UserRole.USER);
        UUID id = createdId(user, "100g", "[{\"code\":\"piece\",\"base_amount\":120,\"default\":true},"
                + "{\"code\":\"package\",\"base_amount\":450}]");

        perform(user, put("/api/products/" + id).contentType(MediaType.APPLICATION_JSON)
                .content(body("Banana", "100g", "[{\"code\":\"slice\",\"base_amount\":20},"
                        + "{\"code\":\"package\",\"base_amount\":500,\"default\":true}]")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.measures[*].code", contains("package", "slice", "g")))
                .andExpect(jsonPath("$.measures[*].base_amount", contains(500.0, 20.0, 1.0)));

        perform(user, put("/api/products/" + id).contentType(MediaType.APPLICATION_JSON)
                .content(body("Banana", "100g", null)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.measures[*].code", contains("package", "slice", "g")));

        perform(user, get("/api/products/" + id))
                .andExpect(jsonPath("$.measures[*].code", contains("package", "slice", "g")));

        perform(user, put("/api/products/" + id).contentType(MediaType.APPLICATION_JSON)
                .content(body("Banana", "100g", "[]")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.measures[*].code", contains("g")));
    }

    @Test
    void ownVersionKeepsTheMeasuresOfTheOriginalUnlessNewOnesAreSent() throws Exception {
        Product original = new Product();
        original.setName("Verified banana " + UUID.randomUUID());
        original.setKcal(89.0);
        original.setProtein(1.1);
        original.setFat(0.3);
        original.setCarbs(23.0);
        original.setUnit("100g");
        original.setStatus(ProductStatus.VERIFIED);
        original.setSource(ProductSource.OPEN_FOOD_FACTS);
        UUID originalId = productRepository.save(original).getId();
        perform(saveUser(UserRole.ADMIN), put("/api/products/" + originalId).contentType(MediaType.APPLICATION_JSON)
                .content(body(original.getName(), "100g", "[{\"code\":\"piece\",\"base_amount\":120}]")))
                .andExpect(status().isOk());

        perform(saveUser(UserRole.USER), post("/api/products/" + originalId + "/own-version"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.measures[*].code", contains("g", "piece")))
                .andExpect(jsonPath("$.measures[1].base_amount").value(120.0));

        perform(saveUser(UserRole.USER), post("/api/products/" + originalId + "/own-version")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body("Banana", "100g", "[{\"code\":\"tbsp\",\"base_amount\":15,\"default\":true}]")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.measures[*].code", contains("tbsp", "g")));
    }

    @Test
    void searchResultsIncludeMeasures() throws Exception {
        User user = saveUser(UserRole.USER);
        String name = "Measured banana " + UUID.randomUUID().toString().substring(0, 8);
        perform(user, post("/api/products").contentType(MediaType.APPLICATION_JSON)
                .content(body(name, "100g", "[{\"code\":\"piece\",\"base_amount\":120,\"default\":true}]")))
                .andExpect(status().isOk());

        perform(user, get("/api/products/search").param("q", name))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].measures[*].code", contains("piece", "g")));
    }

    @Test
    void listsMeasureKindsInTheirOrder() throws Exception {
        mockMvc.perform(get("/api/measure-kinds"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].code", contains("piece", "slice", "tbsp", "tsp", "cup", "package")))
                .andExpect(jsonPath("$[2].names.pl.many").value("łyżek"))
                .andExpect(jsonPath("$[4].max_amount").value(50.0))
                .andExpect(jsonPath("$[5].max_base_amount").value(50000.0));
    }
}
