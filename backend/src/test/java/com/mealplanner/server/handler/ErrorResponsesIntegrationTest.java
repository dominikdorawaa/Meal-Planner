package com.mealplanner.server.handler;

import com.mealplanner.server.TestcontainersConfiguration;
import com.mealplanner.server.auth.JwtService;
import com.mealplanner.server.config.LocaleConfig;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.MessageSource;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Locale;
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

    private static final Locale POLISH = LocaleConfig.DEFAULT_LOCALE;

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private MessageSource messageSource;

    private String message(String key, Locale locale) {
        return messageSource.getMessage(key, null, locale);
    }

    private String registerBody(String email) {
        return "{\"email\":\"" + email + "\",\"name\":\"Alice\",\"password\":\"secret123\"}";
    }

    private String uniqueEmail() {
        return "user-" + UUID.randomUUID() + "@example.com";
    }

    @Test
    void registrationWithInvalidDataReturnsPolishMessageByDefault() throws Exception {
        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(registerBody("not-an-email")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value(message("validation.email.invalid", POLISH)));
    }

    @Test
    void registrationWithInvalidDataReturnsEnglishMessageWhenRequested() throws Exception {
        mockMvc.perform(post("/api/auth/register")
                        .header(HttpHeaders.ACCEPT_LANGUAGE, "en")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"alice@example.com\",\"name\":\"Alice\",\"password\":\"abc\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Password must be at least 6 characters long"));
    }

    @Test
    void registrationWithMalformedJsonReturnsBadRequest() throws Exception {
        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value(message(GlobalExceptionHandler.BAD_REQUEST, POLISH)));
    }

    @Test
    void registrationWithTakenEmailReturnsTranslatedMessage() throws Exception {
        String email = uniqueEmail();
        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(registerBody(email)))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/auth/register")
                        .header(HttpHeaders.ACCEPT_LANGUAGE, "en")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(registerBody(email)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("A user with this email already exists."));
    }

    @Test
    void loginWithWrongPasswordReturnsUnauthorized() throws Exception {
        String email = uniqueEmail();
        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(registerBody(email)))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"wrong-password\"}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value(message("auth.invalid-credentials", POLISH)));
    }

    @Test
    void loginOfUnknownUserReturnsUnauthorized() throws Exception {
        mockMvc.perform(post("/api/auth/login")
                        .header(HttpHeaders.ACCEPT_LANGUAGE, "en")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + uniqueEmail() + "\",\"password\":\"secret123\"}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("Invalid email or password."));
    }

    @Test
    void loginOfRegisteredUserSucceeds() throws Exception {
        String email = uniqueEmail();
        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(registerBody(email)))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"secret123\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").isNotEmpty());
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
                .andExpect(jsonPath("$.error").value(message(GlobalExceptionHandler.UNAUTHORIZED, POLISH)));
    }

    @ParameterizedTest
    @CsvSource({
            "GET, /api/auth/me, ",
            "GET, /api/meals, ",
            "GET, /api/meals/day/2026-10-14, ",
            "POST, /api/meals, {}",
            "POST, /api/recipes, {}",
            "GET, /api/shopping-list, ",
            "GET, /api/shopping-list/recipes, ",
            "POST, /api/shopping-list, {}",
            "POST, /api/shopping-list/recipes, {}",
            "DELETE, /api/shopping-list/clear, ",
            "GET, /api/profile, ",
            "PUT, /api/profile, {}"
    })
    void requestWithoutTokenReturnsTranslatedUnauthorized(String method, String path, String body) throws Exception {
        mockMvc.perform(request(HttpMethod.valueOf(method), path)
                        .header(HttpHeaders.ACCEPT_LANGUAGE, "en")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body == null ? "" : body))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("Authentication required."));
    }

    @Test
    void profileUpdateOfExistingUserSucceeds() throws Exception {
        String email = uniqueEmail();
        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(registerBody(email)))
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
        mockMvc.perform(get("/api/recipes/not-a-uuid").header(HttpHeaders.ACCEPT_LANGUAGE, "en"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Malformed request."));
    }
}
