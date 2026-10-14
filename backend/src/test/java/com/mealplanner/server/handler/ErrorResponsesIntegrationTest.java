package com.mealplanner.server.handler;

import com.mealplanner.server.TestcontainersConfiguration;
import com.mealplanner.server.auth.JwtService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class ErrorResponsesIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtService jwtService;

    @Test
    void registrationWithInvalidDataReturnsBadRequest() throws Exception {
        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"not-an-email\",\"name\":\"Alice\",\"password\":\"secret123\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").isNotEmpty());
    }

    @Test
    void registrationWithMalformedJsonReturnsBadRequest() throws Exception {
        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value(GlobalExceptionHandler.BAD_REQUEST));
    }

    @ParameterizedTest
    @CsvSource({
            "GET, /api/meals, ",
            "GET, /api/meals/day/2026-10-14, ",
            "POST, /api/meals, {}",
            "POST, /api/recipes, {}",
            "GET, /api/shopping-list, ",
            "PUT, /api/profile, {}"
    })
    void tokenOfMissingUserReturnsUnauthorized(String method, String path, String body) throws Exception {
        String token = jwtService.generateToken(UUID.randomUUID(), "missing@example.com");

        mockMvc.perform(request(HttpMethod.valueOf(method), path)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body == null ? "" : body))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value(GlobalExceptionHandler.UNAUTHORIZED));
    }

    @Test
    void profileUpdateOfExistingUserSucceeds() throws Exception {
        String email = "profile-" + UUID.randomUUID() + "@example.com";
        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"name\":\"Alice\",\"password\":\"secret123\"}"))
                .andExpect(status().isOk());
        String token = jwtService.generateToken(UUID.randomUUID(), email);

        mockMvc.perform(put("/api/profile")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"display_name\":\"Alice\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.display_name").value("Alice"));
    }

    @Test
    void wrongPathVariableTypeReturnsBadRequest() throws Exception {
        mockMvc.perform(get("/api/recipes/not-a-uuid"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value(GlobalExceptionHandler.BAD_REQUEST));
    }
}
