package com.mealplanner.server.recipe;

import com.mealplanner.server.TestcontainersConfiguration;
import com.mealplanner.server.auth.JwtService;
import com.mealplanner.server.handler.ApiException;
import com.mealplanner.server.user.User;
import com.mealplanner.server.user.UserRepository;
import com.mealplanner.server.user.UserRole;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Arrays;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.endsWith;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class RecipeImageUploadIntegrationTest {

    private static final byte[] JPEG = {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xE0, 0, 16, 'J', 'F', 'I', 'F'};
    private static final byte[] PNG = {(byte) 0x89, 'P', 'N', 'G', '\r', '\n', 0x1A, '\n', 0, 0};
    private static final byte[] WEBP = {'R', 'I', 'F', 'F', 0, 0, 0, 0, 'W', 'E', 'B', 'P', 'V', 'P'};

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private UserRepository userRepository;

    @MockitoBean
    private RecipeImageStorage storage;

    private User saveUser() {
        User user = new User();
        user.setEmail("user-" + UUID.randomUUID() + "@example.com");
        user.setPasswordHash("hash");
        user.setRole(UserRole.USER);
        return userRepository.save(user);
    }

    private String bearer(User user) {
        return "Bearer " + jwtService.generateToken(user.getId(), user.getEmail());
    }

    private static MockMultipartFile file(byte[] content, String contentType) {
        return new MockMultipartFile("file", "photo", contentType, content);
    }

    @Test
    void storesJpegUnderTheUserFolderAndReturnsItsPublicUrl() throws Exception {
        User user = saveUser();
        when(storage.store(anyString(), any(), anyString())).thenReturn("https://cdn.example.com/photo.jpg");

        mockMvc.perform(multipart("/api/recipes/images")
                        .file(file(JPEG, "image/jpeg"))
                        .header(HttpHeaders.AUTHORIZATION, bearer(user)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.url").value("https://cdn.example.com/photo.jpg"));

        ArgumentCaptor<String> path = ArgumentCaptor.forClass(String.class);
        verify(storage).store(path.capture(), eq(JPEG), eq("image/jpeg"));
        assertThat(path.getValue()).matches(user.getId() + "/[0-9a-f-]{36}\\.jpg");
    }

    @Test
    void detectsTheTypeFromTheFileContentInsteadOfTheDeclaredType() throws Exception {
        User user = saveUser();
        when(storage.store(anyString(), any(), anyString())).thenReturn("https://cdn.example.com/a");

        mockMvc.perform(multipart("/api/recipes/images").file(file(PNG, "image/jpeg")).header(HttpHeaders.AUTHORIZATION, bearer(user)))
                .andExpect(status().isOk());
        mockMvc.perform(multipart("/api/recipes/images").file(file(WEBP, "application/octet-stream")).header(HttpHeaders.AUTHORIZATION, bearer(user)))
                .andExpect(status().isOk());

        verify(storage).store(endsWith(".png"), eq(PNG), eq("image/png"));
        verify(storage).store(endsWith(".webp"), eq(WEBP), eq("image/webp"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"GIF89a-not-allowed", "<svg xmlns='http://www.w3.org/2000/svg'/>", "RIFF"})
    void rejectsFilesThatAreNotSupportedImages(String content) throws Exception {
        mockMvc.perform(multipart("/api/recipes/images")
                        .file(file(content.getBytes(), "image/png"))
                        .header(HttpHeaders.ACCEPT_LANGUAGE, "en")
                        .header(HttpHeaders.AUTHORIZATION, bearer(saveUser())))
                .andExpect(status().isUnsupportedMediaType())
                .andExpect(jsonPath("$.error").value("Unsupported photo format. Use JPEG, PNG or WebP."));

        verify(storage, never()).store(anyString(), any(), anyString());
    }

    @Test
    void rejectsMissingAndEmptyFiles() throws Exception {
        String token = bearer(saveUser());

        mockMvc.perform(multipart("/api/recipes/images").header(HttpHeaders.AUTHORIZATION, token))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Wybierz zdjęcie."));
        mockMvc.perform(multipart("/api/recipes/images").file(file(new byte[0], "image/jpeg")).header(HttpHeaders.AUTHORIZATION, token))
                .andExpect(status().isBadRequest());
    }

    @Test
    void rejectsFilesAboveFiveMegabytes() throws Exception {
        byte[] large = Arrays.copyOf(JPEG, (int) RecipeImageService.MAX_SIZE_BYTES + 1);

        mockMvc.perform(multipart("/api/recipes/images")
                        .file(file(large, "image/jpeg"))
                        .header(HttpHeaders.AUTHORIZATION, bearer(saveUser())))
                .andExpect(status().isPayloadTooLarge());

        verify(storage, never()).store(anyString(), any(), anyString());
    }

    @Test
    void requiresAuthentication() throws Exception {
        mockMvc.perform(multipart("/api/recipes/images").file(file(JPEG, "image/jpeg")))
                .andExpect(status().isUnauthorized());

        verify(storage, never()).store(anyString(), any(), anyString());
    }

    @Test
    void reportsStorageErrors() throws Exception {
        when(storage.store(anyString(), any(), anyString()))
                .thenThrow(new ApiException(HttpStatus.SERVICE_UNAVAILABLE, SupabaseRecipeImageStorage.UPLOAD_UNAVAILABLE));

        mockMvc.perform(multipart("/api/recipes/images")
                        .file(file(JPEG, "image/jpeg"))
                        .header(HttpHeaders.AUTHORIZATION, bearer(saveUser())))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.error").value("Przesyłanie zdjęć jest chwilowo niedostępne."));
    }
}
