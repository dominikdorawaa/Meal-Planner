package com.mealplanner.server.recipe;

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
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.util.UUID;

import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class RecipeIngredientProductIntegrationTest {

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

    private String bearer() {
        User user = new User();
        user.setEmail("user-" + UUID.randomUUID() + "@example.com");
        user.setPasswordHash("hash");
        user.setRole(UserRole.USER);
        user = userRepository.save(user);
        return "Bearer " + jwtService.generateToken(user.getId(), user.getEmail());
    }

    private Product saveProduct() {
        Product product = new Product();
        product.setName("Cream");
        product.setKcal(186.0);
        product.setProtein(2.6);
        product.setFat(18.0);
        product.setCarbs(3.4);
        product.setSaturatedFat(12.0);
        product.setSugars(3.4);
        product.setFiber(0.0);
        product.setSalt(0.1);
        return productRepository.save(product);
    }

    private static String recipeJson(String name, String productId) {
        return "{\"name\":\"" + name + "\",\"portions\":2,\"ingredients\":["
                + "{\"name\":\"Cream\",\"amount\":200,\"unit\":\"g\",\"product\":{\"id\":\"" + productId + "\"}},"
                + "{\"name\":\"Salt\",\"amount\":1,\"unit\":\"g\"}]}";
    }

    private String createRecipe(String token, String productId) throws Exception {
        String body = mockMvc.perform(post("/api/recipes")
                        .header(HttpHeaders.AUTHORIZATION, token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(recipeJson("Sauce", productId)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        JsonNode recipe = objectMapper.readTree(body);
        return recipe.get("id").asString();
    }

    @Test
    void keepsTheProductOfEachIngredientWithItsNutrients() throws Exception {
        String token = bearer();
        Product product = saveProduct();
        String recipeId = createRecipe(token, product.getId().toString());

        mockMvc.perform(get("/api/recipes/" + recipeId).header(HttpHeaders.AUTHORIZATION, token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ingredients[?(@.name == 'Cream')].product.id").value(product.getId().toString()))
                .andExpect(jsonPath("$.ingredients[?(@.name == 'Cream')].product.saturated_fat").value(12.0))
                .andExpect(jsonPath("$.ingredients[?(@.name == 'Salt')].product").value(hasItem(
                        nullValue())));
    }

    @Test
    void linksProductsWhenARecipeIsUpdatedAndDropsUnknownOnes() throws Exception {
        String token = bearer();
        Product product = saveProduct();
        String recipeId = createRecipe(token, UUID.randomUUID().toString());

        mockMvc.perform(get("/api/recipes/" + recipeId).header(HttpHeaders.AUTHORIZATION, token))
                .andExpect(jsonPath("$.ingredients[?(@.name == 'Cream')].product").value(hasItem(
                        nullValue())));

        mockMvc.perform(put("/api/recipes/" + recipeId)
                        .header(HttpHeaders.AUTHORIZATION, token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(recipeJson("Sauce", product.getId().toString())))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/recipes/" + recipeId).header(HttpHeaders.AUTHORIZATION, token))
                .andExpect(jsonPath("$.ingredients[?(@.name == 'Cream')].product.sugars").value(3.4));
    }

    @Test
    void recipeNutritionFollowsItsProducts() throws Exception {
        String token = bearer();
        Product product = saveProduct();
        String recipeId = createRecipe(token, product.getId().toString());

        mockMvc.perform(get("/api/recipes/" + recipeId).header(HttpHeaders.AUTHORIZATION, token))
                .andExpect(jsonPath("$.kcal").value(186.0))
                .andExpect(jsonPath("$.fat").value(18.0));

        product.setKcal(200.0);
        productRepository.save(product);

        mockMvc.perform(get("/api/recipes/" + recipeId).header(HttpHeaders.AUTHORIZATION, token))
                .andExpect(jsonPath("$.kcal").value(200.0))
                .andExpect(jsonPath("$.protein").value(2.6));
    }

    @Test
    void keepsTheIngredientWhenItsProductIsRemoved() throws Exception {
        String token = bearer();
        Product product = saveProduct();
        String recipeId = createRecipe(token, product.getId().toString());

        productRepository.deleteById(product.getId());

        mockMvc.perform(get("/api/recipes/" + recipeId).header(HttpHeaders.AUTHORIZATION, token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ingredients.length()").value(2))
                .andExpect(jsonPath("$.ingredients[?(@.name == 'Cream')].product").value(hasItem(
                        nullValue())));
    }
}
