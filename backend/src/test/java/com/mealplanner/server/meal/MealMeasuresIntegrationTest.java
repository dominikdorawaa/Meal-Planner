package com.mealplanner.server.meal;

import com.mealplanner.server.TestcontainersConfiguration;
import com.mealplanner.server.auth.JwtService;
import com.mealplanner.server.product.Product;
import com.mealplanner.server.product.ProductRepository;
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
import tools.jackson.databind.ObjectMapper;

import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class MealMeasuresIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private ObjectMapper objectMapper;

    private String bearerForNewUser() {
        User user = new User();
        user.setEmail("meal-measures-" + UUID.randomUUID() + "@example.com");
        user.setPasswordHash("hash");
        user.setRole(UserRole.USER);
        user = userRepository.save(user);
        return "Bearer " + jwtService.generateToken(user.getId(), user.getEmail());
    }

    private Product saveProduct() {
        Product product = new Product();
        product.setName("Banana " + UUID.randomUUID());
        product.setKcal(89.0);
        product.setProtein(1.1);
        product.setFat(0.3);
        product.setCarbs(23.0);
        product.setUnit("100g");
        return productRepository.save(product);
    }

    @Test
    void remembersTheMeasureChosenForAProductInThePlan() throws Exception {
        String bearer = bearerForNewUser();
        Product product = saveProduct();

        String response = mockMvc.perform(post("/api/meals")
                        .header(HttpHeaders.AUTHORIZATION, bearer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"meal_date\":\"2026-10-21\",\"meal_type\":\"breakfast\",\"product\":{\"id\":\""
                                + product.getId() + "\"},\"portions_consumed\":240,\"measure_code\":\"piece\","
                                + "\"measure_amount\":2}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.portions_consumed").value(240.0))
                .andExpect(jsonPath("$.measure_code").value("piece"))
                .andExpect(jsonPath("$.measure_amount").value(2.0))
                .andReturn().getResponse().getContentAsString();
        String mealId = objectMapper.readTree(response).get("id").asString();

        mockMvc.perform(put("/api/meals/" + mealId)
                        .header(HttpHeaders.AUTHORIZATION, bearer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"portions_consumed\":150}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.portions_consumed").value(150.0))
                .andExpect(jsonPath("$.measure_code").doesNotExist())
                .andExpect(jsonPath("$.measure_amount").doesNotExist());
    }
}
