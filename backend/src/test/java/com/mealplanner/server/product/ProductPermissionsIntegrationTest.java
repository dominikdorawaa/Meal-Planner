package com.mealplanner.server.product;

import com.mealplanner.server.TestcontainersConfiguration;
import com.mealplanner.server.auth.JwtService;
import com.mealplanner.server.meal.UserMeal;
import com.mealplanner.server.meal.UserMealRepository;
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

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class ProductPermissionsIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private UserMealRepository userMealRepository;

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
        product.setName("Product " + status);
        product.setBarCode("test-" + UUID.randomUUID());
        product.setStatus(status);
        product.setCreatedBy(createdBy);
        return productRepository.save(product);
    }

    private void saveMealWith(Product product, User user) {
        UserMeal meal = new UserMeal();
        meal.setUser(user);
        meal.setDateStr("16.10");
        meal.setMealType("breakfast");
        meal.setProduct(product);
        userMealRepository.save(meal);
    }

    @Test
    void regularUserCreatesPendingProductOwnedByThemIgnoringClientValues() throws Exception {
        User user = saveUser(UserRole.USER);
        UUID someoneElse = saveUser(UserRole.USER).getId();

        mockMvc.perform(post("/api/products")
                        .header(HttpHeaders.AUTHORIZATION, bearer(user))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Twarog\",\"status\":\"VERIFIED\",\"source\":\"OFF\","
                                + "\"created_by\":\"" + someoneElse + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PENDING"))
                .andExpect(jsonPath("$.source").value("USER"))
                .andExpect(jsonPath("$.created_by").value(user.getId().toString()));
    }

    @Test
    void adminCreatesVerifiedProduct() throws Exception {
        User admin = saveUser(UserRole.ADMIN);

        mockMvc.perform(post("/api/products")
                        .header(HttpHeaders.AUTHORIZATION, bearer(admin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Maslo\",\"status\":\"PENDING\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("VERIFIED"))
                .andExpect(jsonPath("$.source").value("USER"))
                .andExpect(jsonPath("$.created_by").value(admin.getId().toString()));
    }

    @Test
    void createdProductCannotOverwriteAnExistingOne() throws Exception {
        User user = saveUser(UserRole.USER);
        Product existing = saveProduct(ProductStatus.VERIFIED, null);

        mockMvc.perform(post("/api/products")
                        .header(HttpHeaders.AUTHORIZATION, bearer(user))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"id\":\"" + existing.getId() + "\",\"name\":\"Overwritten\"}"))
                .andExpect(status().isOk());

        assertThat(productRepository.findById(existing.getId()).orElseThrow().getName())
                .isEqualTo("Product VERIFIED");
    }

    @Test
    void anonymousUserCannotCreateOrDeleteProducts() throws Exception {
        Product product = saveProduct(ProductStatus.VERIFIED, null);

        mockMvc.perform(post("/api/products")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Anonymous\"}"))
                .andExpect(status().isForbidden());
        mockMvc.perform(delete("/api/products/" + product.getId()))
                .andExpect(status().isForbidden());

        assertThat(productRepository.existsById(product.getId())).isTrue();
    }

    @Test
    void regularUserCannotDeleteSomeoneElsesProduct() throws Exception {
        User user = saveUser(UserRole.USER);
        Product product = saveProduct(ProductStatus.PENDING, saveUser(UserRole.USER).getId());

        mockMvc.perform(delete("/api/products/" + product.getId()).header(HttpHeaders.AUTHORIZATION, bearer(user)))
                .andExpect(status().isForbidden());

        assertThat(productRepository.findById(product.getId()).orElseThrow().getDeletedAt()).isNull();
    }

    @Test
    void regularUserCannotDeleteTheirOwnVerifiedProduct() throws Exception {
        User user = saveUser(UserRole.USER);
        Product product = saveProduct(ProductStatus.VERIFIED, user.getId());

        mockMvc.perform(delete("/api/products/" + product.getId()).header(HttpHeaders.AUTHORIZATION, bearer(user)))
                .andExpect(status().isForbidden());
    }

    @Test
    void regularUserDeletesTheirOwnUnusedPendingProduct() throws Exception {
        User user = saveUser(UserRole.USER);
        Product product = saveProduct(ProductStatus.PENDING, user.getId());

        mockMvc.perform(delete("/api/products/" + product.getId()).header(HttpHeaders.AUTHORIZATION, bearer(user)))
                .andExpect(status().isOk());

        assertThat(productRepository.existsById(product.getId())).isFalse();
    }

    @Test
    void deletingProductUsedInMealsHidesItAndKeepsTheMeals() throws Exception {
        User admin = saveUser(UserRole.ADMIN);
        User owner = saveUser(UserRole.USER);
        Product product = saveProduct(ProductStatus.VERIFIED, null);
        saveMealWith(product, owner);

        mockMvc.perform(delete("/api/products/" + product.getId()).header(HttpHeaders.AUTHORIZATION, bearer(admin)))
                .andExpect(status().isOk());

        assertThat(productRepository.findById(product.getId()).orElseThrow().getDeletedAt()).isNotNull();
        assertThat(userMealRepository.findByUser(owner)).hasSize(1);
        mockMvc.perform(get("/api/products"))
                .andExpect(jsonPath("$[*].id", not(hasItem(product.getId().toString()))));
        mockMvc.perform(get("/api/products/barcode/" + product.getBarCode()))
                .andExpect(status().isNotFound());
        mockMvc.perform(get("/api/products/" + product.getId()))
                .andExpect(status().isOk());
    }

    @Test
    void deletedVerifiedProductFreesItsBarCode() throws Exception {
        User admin = saveUser(UserRole.ADMIN);
        Product product = saveProduct(ProductStatus.VERIFIED, null);
        saveMealWith(product, admin);

        mockMvc.perform(delete("/api/products/" + product.getId()).header(HttpHeaders.AUTHORIZATION, bearer(admin)))
                .andExpect(status().isOk());

        Product replacement = new Product();
        replacement.setName("Replacement");
        replacement.setBarCode(product.getBarCode());
        productRepository.save(replacement);
        mockMvc.perform(get("/api/products/barcode/" + product.getBarCode()))
                .andExpect(jsonPath("$.name").value("Replacement"));
    }

    @Test
    void deletingAlreadyDeletedOrMissingProductReturnsNotFound() throws Exception {
        User admin = saveUser(UserRole.ADMIN);
        Product product = saveProduct(ProductStatus.VERIFIED, null);
        saveMealWith(product, admin);
        mockMvc.perform(delete("/api/products/" + product.getId()).header(HttpHeaders.AUTHORIZATION, bearer(admin)));

        mockMvc.perform(delete("/api/products/" + product.getId()).header(HttpHeaders.AUTHORIZATION, bearer(admin)))
                .andExpect(status().isNotFound());
        mockMvc.perform(delete("/api/products/" + UUID.randomUUID()).header(HttpHeaders.AUTHORIZATION, bearer(admin)))
                .andExpect(status().isNotFound());
    }

    @Test
    void loginResponseContainsUserRole() throws Exception {
        String email = "user-" + UUID.randomUUID() + "@example.com";

        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"name\":\"Alice\",\"password\":\"secret123\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role").value("USER"));
        User user = userRepository.findByEmail(email).orElseThrow();
        user.setRole(UserRole.ADMIN);
        userRepository.save(user);

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"secret123\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role").value("ADMIN"));
    }
}
