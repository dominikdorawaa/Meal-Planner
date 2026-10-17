package com.mealplanner.server.auth;

import com.mealplanner.server.TestcontainersConfiguration;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.AuthenticationCredentialsNotFoundException;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.time.Duration;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.within;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class AuthRefreshIntegrationTest {

    private static final long SIXTY_DAYS_MS = Duration.ofDays(60).toMillis();

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private AuthService authService;

    @Value("${jwt.secret}")
    private String jwtSecret;

    private final ObjectMapper objectMapper = new ObjectMapper();

    private String registerAndGetToken(String email) throws Exception {
        String body = mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"name\":\"Alice\",\"password\":\"secret123\"}"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(body).get("token").asString();
    }

    private String uniqueEmail() {
        return "refresh-" + UUID.randomUUID() + "@example.com";
    }

    private long expiresInMs(String token) {
        return jwtService.parseClaims(token).getExpiration().getTime() - System.currentTimeMillis();
    }

    @Test
    void issuedTokenIsValidForSixtyDays() throws Exception {
        String token = registerAndGetToken(uniqueEmail());

        assertThat(expiresInMs(token)).isCloseTo(SIXTY_DAYS_MS, within(Duration.ofMinutes(1).toMillis()));
    }

    @Test
    void refreshReturnsNewSixtyDayTokenForSignedInUser() throws Exception {
        String email = uniqueEmail();
        String oldToken = new JwtService(jwtSecret, Duration.ofDays(1).toMillis())
                .generateToken(UUID.randomUUID(), email);
        registerAndGetToken(email);

        String body = mockMvc.perform(post("/api/auth/refresh")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + oldToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value(email))
                .andExpect(jsonPath("$.name").value("Alice"))
                .andExpect(jsonPath("$.role").value("USER"))
                .andReturn().getResponse().getContentAsString();

        JsonNode response = objectMapper.readTree(body);
        String newToken = response.get("token").asString();
        assertThat(newToken).isNotEqualTo(oldToken);
        assertThat(jwtService.getEmail(newToken)).isEqualTo(email);
        assertThat(jwtService.getUserId(newToken)).isEqualTo(response.get("user_id").asString());
        assertThat(expiresInMs(newToken)).isCloseTo(SIXTY_DAYS_MS, within(Duration.ofMinutes(1).toMillis()));
    }

    @Test
    void refreshWithExpiredTokenIsRejected() throws Exception {
        String email = uniqueEmail();
        registerAndGetToken(email);
        String expiredToken = new JwtService(jwtSecret, -1000).generateToken(UUID.randomUUID(), email);

        mockMvc.perform(post("/api/auth/refresh")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + expiredToken))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void refreshWithoutTokenIsRejected() throws Exception {
        mockMvc.perform(post("/api/auth/refresh"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void refreshForUnknownUserIsRejected() {
        assertThatThrownBy(() -> authService.refresh(uniqueEmail()))
                .isInstanceOf(AuthenticationCredentialsNotFoundException.class);
    }
}
