package com.mealplanner.server.recipe;

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
import tools.jackson.databind.ObjectMapper;

import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class RecipeStepIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ObjectMapper objectMapper;

    private String bearer() {
        User user = new User();
        user.setEmail("steps-" + UUID.randomUUID() + "@example.com");
        user.setPasswordHash("hash");
        user.setRole(UserRole.USER);
        user = userRepository.save(user);
        return "Bearer " + jwtService.generateToken(user.getId(), user.getEmail());
    }

    private String create(String token, String steps) throws Exception {
        String body = mockMvc.perform(post("/api/recipes")
                        .header(HttpHeaders.AUTHORIZATION, token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Pasta\",\"ingredients\":[],\"steps\":" + steps + "}"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(body).get("id").asString();
    }

    @Test
    void storesNamedStepsInOrderAndSkipsEmptyOnes() throws Exception {
        String token = bearer();
        String id = create(token, "[{\"name\":\"  Sauce \",\"text\":\"Fry garlic\"},"
                + "{\"name\":\"\",\"text\":\"   \"},null,"
                + "{\"name\":null,\"text\":\"Boil pasta\"},{\"name\":\"Serve\"}]");

        mockMvc.perform(get("/api/recipes/" + id).header(HttpHeaders.AUTHORIZATION, token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.steps.length()").value(3))
                .andExpect(jsonPath("$.steps[0].name").value("Sauce"))
                .andExpect(jsonPath("$.steps[0].text").value("Fry garlic"))
                .andExpect(jsonPath("$.steps[1].name").doesNotExist())
                .andExpect(jsonPath("$.steps[1].text").value("Boil pasta"))
                .andExpect(jsonPath("$.steps[2].name").value("Serve"))
                .andExpect(jsonPath("$.steps[2].text").value(""))
                .andExpect(jsonPath("$.instructions[0]").value("Fry garlic"))
                .andExpect(jsonPath("$.instructions[2]").value("Serve"));
    }

    @Test
    void acceptsPlainTextStepsFromOlderClients() throws Exception {
        String token = bearer();
        String id = create(token, "[]");

        mockMvc.perform(put("/api/recipes/" + id)
                        .header(HttpHeaders.AUTHORIZATION, token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Pasta\",\"ingredients\":[],\"instructions\":[\"Boil pasta\",\"\"]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.instructions.length()").value(1))
                .andExpect(jsonPath("$.steps[0].text").value("Boil pasta"));
    }

    @Test
    void keepsRecipesWithoutSteps() throws Exception {
        mockMvc.perform(post("/api/recipes")
                        .header(HttpHeaders.AUTHORIZATION, bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Pasta\",\"ingredients\":[]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.instructions.length()").value(0));
    }

    @Test
    void rejectsStepNamesLongerThanSixtyCharacters() throws Exception {
        String token = bearer();
        String tooLong = "a".repeat(RecipeStep.MAX_NAME_LENGTH + 1);

        mockMvc.perform(post("/api/recipes")
                        .header(HttpHeaders.AUTHORIZATION, token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Pasta\",\"ingredients\":[],\"steps\":[{\"name\":\"" + tooLong + "\",\"text\":\"x\"}]}"))
                .andExpect(status().isBadRequest());

        create(token, "[{\"name\":\"" + "a".repeat(RecipeStep.MAX_NAME_LENGTH) + "\",\"text\":\"x\"}]");
    }
}
