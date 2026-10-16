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

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class ProductAccessIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ProductRepository productRepository;

    private String tokenFor(UserRole role) {
        User user = new User();
        user.setEmail("user-" + UUID.randomUUID() + "@example.com");
        user.setPasswordHash("hash");
        user.setRole(role);
        User saved = userRepository.save(user);
        return "Bearer " + jwtService.generateToken(saved.getId(), saved.getEmail());
    }

    private Product saveProduct(String barCode, ProductStatus status, String name) {
        Product product = new Product();
        product.setName(name);
        product.setBarCode(barCode);
        product.setStatus(status);
        return productRepository.save(product);
    }

    private String uniqueBarCode() {
        return "test-" + UUID.randomUUID();
    }

    @Test
    void newUsersGetTheRegularUserRole() {
        User user = new User();
        user.setEmail("user-" + UUID.randomUUID() + "@example.com");
        user.setPasswordHash("hash");

        assertThat(userRepository.save(user).getRole()).isEqualTo(UserRole.USER);
    }

    @Test
    void newProductsAreVerifiedUserProductsByDefault() {
        Product product = new Product();
        product.setName("Default product");
        Product stored = productRepository.findById(productRepository.save(product).getId()).orElseThrow();

        assertThat(stored.getStatus()).isEqualTo(ProductStatus.VERIFIED);
        assertThat(stored.getSource()).isEqualTo(ProductSource.USER);
        assertThat(stored.getCreatedBy()).isNull();
    }

    @Test
    void anonymousRequestToAdminEndpointIsForbidden() throws Exception {
        mockMvc.perform(get("/api/admin/products"))
                .andExpect(status().isForbidden());
    }

    @Test
    void regularUserCannotAccessAdminEndpoints() throws Exception {
        mockMvc.perform(get("/api/admin/products").header(HttpHeaders.AUTHORIZATION, tokenFor(UserRole.USER)))
                .andExpect(status().isForbidden());
    }

    @Test
    void adminPassesTheRoleCheckOnAdminEndpoints() throws Exception {
        mockMvc.perform(get("/api/admin/products").header(HttpHeaders.AUTHORIZATION, tokenFor(UserRole.ADMIN)))
                .andExpect(status().isNotFound());
    }

    @Test
    void roleChangeAppliesToExistingTokenOnNextRequest() throws Exception {
        User user = new User();
        user.setEmail("user-" + UUID.randomUUID() + "@example.com");
        user.setPasswordHash("hash");
        user.setRole(UserRole.USER);
        User saved = userRepository.save(user);
        String token = "Bearer " + jwtService.generateToken(saved.getId(), saved.getEmail());

        mockMvc.perform(get("/api/admin/products").header(HttpHeaders.AUTHORIZATION, token))
                .andExpect(status().isForbidden());

        saved.setRole(UserRole.ADMIN);
        userRepository.save(saved);
        mockMvc.perform(get("/api/admin/products").header(HttpHeaders.AUTHORIZATION, token))
                .andExpect(status().isNotFound());

        saved.setRole(UserRole.USER);
        userRepository.save(saved);
        mockMvc.perform(get("/api/admin/products").header(HttpHeaders.AUTHORIZATION, token))
                .andExpect(status().isForbidden());
    }

    @Test
    void tokenOfDeletedUserGrantsNoRole() throws Exception {
        User user = new User();
        user.setEmail("user-" + UUID.randomUUID() + "@example.com");
        user.setPasswordHash("hash");
        user.setRole(UserRole.ADMIN);
        User saved = userRepository.save(user);
        String token = "Bearer " + jwtService.generateToken(saved.getId(), saved.getEmail());
        userRepository.delete(saved);

        mockMvc.perform(get("/api/admin/products").header(HttpHeaders.AUTHORIZATION, token))
                .andExpect(status().isForbidden());
    }

    @Test
    void barCodeLookupReturnsOnlyTheVerifiedProduct() throws Exception {
        String barCode = uniqueBarCode();
        saveProduct(barCode, ProductStatus.PENDING, "Pending product");
        saveProduct(barCode, ProductStatus.VERIFIED, "Verified product");

        mockMvc.perform(get("/api/products/barcode/" + barCode))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Verified product"))
                .andExpect(jsonPath("$.status").value("VERIFIED"))
                .andExpect(jsonPath("$.source").value("USER"));
    }

    @Test
    void barCodeLookupIgnoresUnverifiedProducts() throws Exception {
        String barCode = uniqueBarCode();
        saveProduct(barCode, ProductStatus.PENDING, "Pending product");
        saveProduct(barCode, ProductStatus.REJECTED, "Rejected product");

        mockMvc.perform(get("/api/products/barcode/" + barCode))
                .andExpect(status().isNotFound());
    }

    @Test
    void createdProductKeepsDefaultStatusAndSourceWhenMissingInRequest() throws Exception {
        mockMvc.perform(post("/api/products")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Twarog\",\"bar_code\":\"" + uniqueBarCode() + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("VERIFIED"))
                .andExpect(jsonPath("$.source").value("USER"));
    }
}
