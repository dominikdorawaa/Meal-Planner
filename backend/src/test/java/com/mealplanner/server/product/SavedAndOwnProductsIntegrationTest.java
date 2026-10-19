package com.mealplanner.server.product;

import com.mealplanner.server.TestcontainersConfiguration;
import com.mealplanner.server.auth.JwtService;
import com.mealplanner.server.user.User;
import com.mealplanner.server.user.UserRepository;
import com.mealplanner.server.user.UserRole;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.time.OffsetDateTime;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class SavedAndOwnProductsIntegrationTest {

    private static final String VALID_BODY = "{\"name\":\"Own skyr\",\"brand\":\"Brand\",\"kcal\":65,\"protein\":12,"
            + "\"fat\":0,\"carbs\":4.2,\"sugars\":4,\"unit\":\"100g\"}";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private SavedProductRepository savedProductRepository;

    private User saveUser(UserRole role) {
        User user = new User();
        user.setEmail("user-" + UUID.randomUUID() + "@example.com");
        user.setPasswordHash("hash");
        user.setRole(role);
        return userRepository.save(user);
    }

    private String bearer(User user) {
        return "Bearer " + jwtService.generateToken(user.getId(), user.getEmail());
    }

    private Product saveProduct(ProductStatus status, UUID createdBy) {
        Product product = new Product();
        product.setName("Base " + UUID.randomUUID());
        product.setKcal(65.0);
        product.setProtein(12.0);
        product.setFat(0.0);
        product.setCarbs(4.2);
        product.setBarCode(uniqueValidBarCode());
        product.setStatus(status);
        product.setSource(createdBy == null ? ProductSource.OPEN_FOOD_FACTS : ProductSource.USER);
        product.setCreatedBy(createdBy);
        return productRepository.save(product);
    }

    private static String uniqueValidBarCode() {
        String digits = String.format("%012d", Math.floorMod(UUID.randomUUID().getMostSignificantBits(), 1_000_000_000_000L));
        int sum = 0;
        for (int i = 0; i < digits.length(); i++) {
            sum += (digits.charAt(i) - '0') * (i % 2 == 0 ? 1 : 3);
        }
        return digits + (10 - sum % 10) % 10;
    }

    private ResultActions perform(User user, MockHttpServletRequestBuilder request)
            throws Exception {
        return mockMvc.perform(request.header(HttpHeaders.AUTHORIZATION, bearer(user)));
    }

    @Test
    void savesListsAndUnsavesBaseProducts() throws Exception {
        User user = saveUser(UserRole.USER);
        Product first = saveProduct(ProductStatus.VERIFIED, null);
        Product second = saveProduct(ProductStatus.VERIFIED, null);

        perform(user, post("/api/products/" + first.getId() + "/saved")).andExpect(status().isNoContent());
        perform(user, post("/api/products/" + second.getId() + "/saved")).andExpect(status().isNoContent());
        perform(user, post("/api/products/" + second.getId() + "/saved")).andExpect(status().isNoContent());

        perform(user, get("/api/products/saved"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].id", contains(second.getId().toString(), first.getId().toString())));

        perform(user, delete("/api/products/" + second.getId() + "/saved")).andExpect(status().isNoContent());
        perform(user, delete("/api/products/" + second.getId() + "/saved")).andExpect(status().isNoContent());

        perform(user, get("/api/products/saved"))
                .andExpect(jsonPath("$[*].id", contains(first.getId().toString())));
        assertThat(productRepository.existsById(second.getId())).isTrue();
    }

    @Test
    void savedProductsAreSeparateForEachUser() throws Exception {
        User user = saveUser(UserRole.USER);
        User other = saveUser(UserRole.USER);
        Product product = saveProduct(ProductStatus.VERIFIED, null);

        perform(user, post("/api/products/" + product.getId() + "/saved")).andExpect(status().isNoContent());

        perform(other, get("/api/products/saved")).andExpect(jsonPath("$", empty()));
    }

    @Test
    void cannotSaveMissingOrSomeoneElsesPendingProduct() throws Exception {
        User user = saveUser(UserRole.USER);
        Product pending = saveProduct(ProductStatus.PENDING, saveUser(UserRole.USER).getId());

        perform(user, post("/api/products/" + pending.getId() + "/saved")).andExpect(status().isNotFound());
        perform(user, post("/api/products/" + UUID.randomUUID() + "/saved")).andExpect(status().isNotFound());
        assertThat(savedProductRepository.existsByUserIdAndProductId(user.getId(), pending.getId())).isFalse();
    }

    @Test
    void deletedProductsDisappearFromSaved() throws Exception {
        User user = saveUser(UserRole.USER);
        Product product = saveProduct(ProductStatus.VERIFIED, null);
        perform(user, post("/api/products/" + product.getId() + "/saved")).andExpect(status().isNoContent());

        product.setDeletedAt(OffsetDateTime.now());
        productRepository.save(product);

        perform(user, get("/api/products/saved")).andExpect(jsonPath("$", empty()));
    }

    @Test
    void anonymousUserCannotUseSavedOrOwnProducts() throws Exception {
        Product product = saveProduct(ProductStatus.VERIFIED, null);

        mockMvc.perform(get("/api/products/saved")).andExpect(status().isForbidden());
        mockMvc.perform(get("/api/products/own")).andExpect(status().isForbidden());
        mockMvc.perform(post("/api/products/" + product.getId() + "/saved")).andExpect(status().isForbidden());
        mockMvc.perform(put("/api/products/" + product.getId())
                        .contentType(MediaType.APPLICATION_JSON).content(VALID_BODY))
                .andExpect(status().isForbidden());
    }

    @Test
    void ownVersionCopiesBaseProductAndLeavesOriginalUntouched() throws Exception {
        User user = saveUser(UserRole.USER);
        Product base = saveProduct(ProductStatus.VERIFIED, null);
        perform(user, post("/api/products/" + base.getId() + "/saved")).andExpect(status().isNoContent());

        perform(user, post("/api/products/" + base.getId() + "/own-version")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"My version\",\"kcal\":70,\"protein\":12,\"fat\":1,\"carbs\":4.2,"
                                + "\"bar_code\":\"" + base.getBarCode() + "\",\"status\":\"VERIFIED\",\"created_by\":\""
                                + UUID.randomUUID() + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("My version"))
                .andExpect(jsonPath("$.status").value("PENDING"))
                .andExpect(jsonPath("$.source").value("USER"))
                .andExpect(jsonPath("$.created_by").value(user.getId().toString()))
                .andExpect(jsonPath("$.bar_code").value(base.getBarCode()));

        Product original = productRepository.findById(base.getId()).orElseThrow();
        assertThat(original.getName()).isEqualTo(base.getName());
        assertThat(original.getKcal()).isEqualTo(65.0);
        assertThat(original.getStatus()).isEqualTo(ProductStatus.VERIFIED);
        perform(user, get("/api/products/saved")).andExpect(jsonPath("$", empty()));
        perform(user, get("/api/products/own"))
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].name").value("My version"));
        perform(user, get("/api/products/barcode/" + base.getBarCode()))
                .andExpect(jsonPath("$.name").value("My version"));
        perform(saveUser(UserRole.USER), get("/api/products/barcode/" + base.getBarCode()))
                .andExpect(jsonPath("$.id").value(base.getId().toString()));
    }

    @Test
    void ownVersionWithoutBodyCopiesAllValues() throws Exception {
        User user = saveUser(UserRole.USER);
        Product base = saveProduct(ProductStatus.VERIFIED, null);

        perform(user, post("/api/products/" + base.getId() + "/own-version"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value(base.getName()))
                .andExpect(jsonPath("$.kcal").value(65.0))
                .andExpect(jsonPath("$.status").value("PENDING"));
    }

    @Test
    void ownVersionKeepsAnOlderBarCodeOfTheBaseProduct() throws Exception {
        User user = saveUser(UserRole.USER);
        Product base = saveProduct(ProductStatus.VERIFIED, null);
        base.setBarCode("5901234567894");
        productRepository.save(base);

        perform(user, post("/api/products/" + base.getId() + "/own-version"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.bar_code").value("5901234567894"));
        perform(user, post("/api/products/" + base.getId() + "/own-version")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Mine\",\"kcal\":65,\"protein\":12,\"fat\":0,\"carbs\":4.2,\"bar_code\":\"5901234567895\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void adminOwnVersionIsAlsoPending() throws Exception {
        User admin = saveUser(UserRole.ADMIN);
        Product base = saveProduct(ProductStatus.VERIFIED, null);

        perform(admin, post("/api/products/" + base.getId() + "/own-version"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PENDING"));
    }

    @Test
    void secondOwnVersionWithTheSameBarCodeIsRejected() throws Exception {
        User user = saveUser(UserRole.USER);
        Product base = saveProduct(ProductStatus.VERIFIED, null);
        perform(user, post("/api/products/" + base.getId() + "/own-version")).andExpect(status().isOk());

        perform(user, post("/api/products/" + base.getId() + "/own-version")).andExpect(status().isConflict());
    }

    @Test
    void ownVersionRejectsInvalidDataAndInvisibleProducts() throws Exception {
        User user = saveUser(UserRole.USER);
        Product base = saveProduct(ProductStatus.VERIFIED, null);
        Product foreignPending = saveProduct(ProductStatus.PENDING, saveUser(UserRole.USER).getId());

        perform(user, post("/api/products/" + base.getId() + "/own-version")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Broken\",\"kcal\":65,\"protein\":12,\"fat\":0,\"carbs\":4.2,\"package_weight\":0}"))
                .andExpect(status().isBadRequest());
        perform(user, post("/api/products/" + foreignPending.getId() + "/own-version"))
                .andExpect(status().isNotFound());
    }

    @Test
    void userEditsTheirOwnPendingProduct() throws Exception {
        User user = saveUser(UserRole.USER);
        Product own = saveProduct(ProductStatus.PENDING, user.getId());

        perform(user, put("/api/products/" + own.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Renamed\",\"kcal\":65,\"protein\":12,\"fat\":0,\"carbs\":4.2,"
                                + "\"bar_code\":\"" + own.getBarCode() + "\",\"status\":\"VERIFIED\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Renamed"))
                .andExpect(jsonPath("$.status").value("PENDING"))
                .andExpect(jsonPath("$.created_by").value(user.getId().toString()));
    }

    @Test
    void userCannotEditBaseOrSomeoneElsesProducts() throws Exception {
        User user = saveUser(UserRole.USER);
        Product base = saveProduct(ProductStatus.VERIFIED, null);
        Product ownVerified = saveProduct(ProductStatus.VERIFIED, user.getId());
        Product foreign = saveProduct(ProductStatus.PENDING, saveUser(UserRole.USER).getId());

        for (Product product : new Product[]{base, ownVerified, foreign}) {
            perform(user, put("/api/products/" + product.getId())
                            .contentType(MediaType.APPLICATION_JSON).content(VALID_BODY))
                    .andExpect(status().isForbidden());
            assertThat(productRepository.findById(product.getId()).orElseThrow().getName())
                    .isEqualTo(product.getName());
        }
        perform(user, put("/api/products/" + UUID.randomUUID())
                        .contentType(MediaType.APPLICATION_JSON).content(VALID_BODY))
                .andExpect(status().isNotFound());
    }

    @Test
    void editCannotTakeTheBarCodeOfABaseProduct() throws Exception {
        User user = saveUser(UserRole.USER);
        Product base = saveProduct(ProductStatus.VERIFIED, null);
        Product own = saveProduct(ProductStatus.PENDING, user.getId());

        perform(user, put("/api/products/" + own.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Own\",\"kcal\":65,\"protein\":12,\"fat\":0,\"carbs\":4.2,"
                                + "\"bar_code\":\"" + base.getBarCode() + "\"}"))
                .andExpect(status().isConflict());
    }

    @Test
    void editRejectsInvalidNutrition() throws Exception {
        User user = saveUser(UserRole.USER);
        Product own = saveProduct(ProductStatus.PENDING, user.getId());

        perform(user, put("/api/products/" + own.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Own\",\"kcal\":950,\"protein\":12,\"fat\":0,\"carbs\":4.2}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void adminEditsBaseProductAndKeepsItsStatus() throws Exception {
        User admin = saveUser(UserRole.ADMIN);
        Product base = saveProduct(ProductStatus.VERIFIED, null);

        perform(admin, put("/api/products/" + base.getId())
                        .contentType(MediaType.APPLICATION_JSON).content(VALID_BODY))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Own skyr"))
                .andExpect(jsonPath("$.status").value("VERIFIED"));
    }

    @Test
    void ownProductsListOnlyTheUsersActiveProductsNewestFirst() throws Exception {
        User user = saveUser(UserRole.USER);
        Product older = saveProduct(ProductStatus.PENDING, user.getId());
        Product newer = saveProduct(ProductStatus.VERIFIED, user.getId());
        Product deleted = saveProduct(ProductStatus.PENDING, user.getId());
        deleted.setDeletedAt(OffsetDateTime.now());
        productRepository.save(deleted);
        saveProduct(ProductStatus.VERIFIED, null);
        saveProduct(ProductStatus.PENDING, saveUser(UserRole.USER).getId());

        perform(user, get("/api/products/own"))
                .andExpect(jsonPath("$[*].id", contains(newer.getId().toString(), older.getId().toString())));
    }

    @Test
    void someoneElsesPendingProductIsHiddenById() throws Exception {
        User author = saveUser(UserRole.USER);
        Product pending = saveProduct(ProductStatus.PENDING, author.getId());

        perform(saveUser(UserRole.USER), get("/api/products/" + pending.getId())).andExpect(status().isNotFound());
        mockMvc.perform(get("/api/products/" + pending.getId())).andExpect(status().isNotFound());
        perform(author, get("/api/products/" + pending.getId())).andExpect(status().isOk());
        perform(saveUser(UserRole.ADMIN), get("/api/products/" + pending.getId())).andExpect(status().isOk());
    }
}
