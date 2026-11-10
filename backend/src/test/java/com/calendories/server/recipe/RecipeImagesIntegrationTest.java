package com.calendories.server.recipe;

import com.calendories.server.TestcontainersConfiguration;
import com.calendories.server.auth.JwtService;
import com.calendories.server.user.User;
import com.calendories.server.user.UserRepository;
import com.calendories.server.user.UserRole;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.ObjectMapper;

import java.util.UUID;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class RecipeImagesIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ObjectMapper objectMapper;

    @MockitoBean
    private RecipeImageStorage storage;

    private String bearer() {
        User user = new User();
        user.setEmail("images-" + UUID.randomUUID() + "@example.com");
        user.setPasswordHash("hash");
        user.setRole(UserRole.USER);
        user = userRepository.save(user);
        return "Bearer " + jwtService.generateToken(user.getId(), user.getEmail());
    }

    private static String body(String images) {
        return "{\"name\":\"Pasta\",\"ingredients\":[],\"steps\":[],\"images\":" + images + "}";
    }

    private String create(String token, String images) throws Exception {
        String response = mockMvc.perform(post("/api/recipes")
                        .header(HttpHeaders.AUTHORIZATION, token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body(images)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(response).get("id").asString();
    }

    private void update(String token, String id, String images) throws Exception {
        mockMvc.perform(put("/api/recipes/" + id)
                        .header(HttpHeaders.AUTHORIZATION, token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body(images)))
                .andExpect(status().isOk());
    }

    @Test
    void storesImagesInOrderWithTheirFocus() throws Exception {
        String token = bearer();
        String id = create(token, "[{\"url\":\" https://cdn.example.com/a.jpg \",\"focus_x\":20,\"focus_y\":140},"
                + "{\"url\":\"   \"},null,"
                + "{\"url\":\"https://cdn.example.com/b.jpg\",\"focus_x\":-5}]");

        mockMvc.perform(get("/api/recipes/" + id).header(HttpHeaders.AUTHORIZATION, token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.images.length()").value(2))
                .andExpect(jsonPath("$.images[0].url").value("https://cdn.example.com/a.jpg"))
                .andExpect(jsonPath("$.images[0].focus_x").value(20.0))
                .andExpect(jsonPath("$.images[0].focus_y").value(100.0))
                .andExpect(jsonPath("$.images[1].url").value("https://cdn.example.com/b.jpg"))
                .andExpect(jsonPath("$.images[1].focus_x").value(0.0))
                .andExpect(jsonPath("$.images[1].focus_y").value(50.0))
                .andExpect(jsonPath("$.image_url").doesNotExist());
    }

    @Test
    void returnsNoImagesWhenNoneWereSent() throws Exception {
        String token = bearer();
        String id = create(token, "null");

        mockMvc.perform(get("/api/recipes").header(HttpHeaders.AUTHORIZATION, token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.id == '" + id + "')].images.length()").value(0));
    }

    @Test
    void rejectsMoreThanThreeImages() throws Exception {
        mockMvc.perform(post("/api/recipes")
                        .header(HttpHeaders.AUTHORIZATION, bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body("[{\"url\":\"https://cdn.example.com/1.jpg\"},{\"url\":\"https://cdn.example.com/2.jpg\"},"
                                + "{\"url\":\"https://cdn.example.com/3.jpg\"},{\"url\":\"https://cdn.example.com/4.jpg\"}]")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Przepis może mieć najwyżej 3 zdjęcia."));
    }

    @Test
    void reordersImagesAndDeletesTheRemovedOnes() throws Exception {
        String token = bearer();
        String id = create(token, "[{\"url\":\"https://cdn.example.com/a.jpg\"},"
                + "{\"url\":\"https://cdn.example.com/b.jpg\"},{\"url\":\"https://cdn.example.com/c.jpg\"}]");

        update(token, id, "[{\"url\":\"https://cdn.example.com/c.jpg\",\"focus_x\":30,\"focus_y\":70},"
                + "{\"url\":\"https://cdn.example.com/a.jpg\"}]");

        mockMvc.perform(get("/api/recipes/" + id).header(HttpHeaders.AUTHORIZATION, token))
                .andExpect(jsonPath("$.images.length()").value(2))
                .andExpect(jsonPath("$.images[0].url").value("https://cdn.example.com/c.jpg"))
                .andExpect(jsonPath("$.images[0].focus_x").value(30.0))
                .andExpect(jsonPath("$.images[1].url").value("https://cdn.example.com/a.jpg"));
        verify(storage).delete("https://cdn.example.com/b.jpg");
        verify(storage, never()).delete("https://cdn.example.com/a.jpg");
        verify(storage, never()).delete("https://cdn.example.com/c.jpg");
    }

    @Test
    void keepsFilesWhenImagesStayTheSame() throws Exception {
        String token = bearer();
        String id = create(token, "[{\"url\":\"https://cdn.example.com/a.jpg\"}]");

        update(token, id, "[{\"url\":\"https://cdn.example.com/a.jpg\",\"focus_x\":10}]");

        verifyNoInteractions(storage);
    }

    @Test
    void keepsFilesWhenTheUpdateFails() throws Exception {
        String token = bearer();
        String id = create(token, "[{\"url\":\"https://cdn.example.com/a.jpg\"}]");

        mockMvc.perform(put("/api/recipes/" + id)
                        .header(HttpHeaders.AUTHORIZATION, token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Pasta\",\"images\":[],\"steps\":[],\"ingredients\":[{\"amount\":1}]}"))
                .andExpect(status().isBadRequest());

        verify(storage, never()).delete(anyString());
    }
}
