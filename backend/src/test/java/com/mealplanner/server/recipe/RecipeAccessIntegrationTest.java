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
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import tools.jackson.databind.ObjectMapper;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class RecipeAccessIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RecipeRepository recipeRepository;

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

    private Recipe saveBaseRecipe(String name) {
        Recipe recipe = new Recipe();
        recipe.setName(name);
        recipe.setVisibility(RecipeVisibility.PUBLIC);
        return recipeRepository.save(recipe);
    }

    private String createRecipe(String token, String name) throws Exception {
        String body = mockMvc.perform(post("/api/recipes")
                        .header(HttpHeaders.AUTHORIZATION, token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"" + name + "\",\"portions\":2,\"is_archived\":true,\"visibility\":\"PUBLIC\","
                                + "\"ingredients\":[]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.own").value(true))
                .andExpect(jsonPath("$.saved").value(false))
                .andExpect(jsonPath("$.visibility").value("PRIVATE"))
                .andExpect(jsonPath("$.is_archived").value(false))
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(body).get("id").asString();
    }

    private MockHttpServletRequestBuilder as(MockHttpServletRequestBuilder request, String token) {
        return request.header(HttpHeaders.AUTHORIZATION, token);
    }

    private List<String> names(String token, String path) throws Exception {
        MockHttpServletRequestBuilder request = get(path);
        if (token != null) {
            request = as(request, token);
        }
        String body = mockMvc.perform(request)
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(body).valueStream().map(node -> node.get("name").asString()).toList();
    }

    @Test
    void listsOwnAndBaseRecipesButNotRecipesOfOtherUsers() throws Exception {
        String alice = bearer();
        String bob = bearer();
        String baseName = "Base " + UUID.randomUUID();
        saveBaseRecipe(baseName);
        String aliceRecipe = "Alice " + UUID.randomUUID();
        createRecipe(alice, aliceRecipe);

        assertThat(names(alice, "/api/recipes")).contains(aliceRecipe, baseName);
        assertThat(names(bob, "/api/recipes")).contains(baseName).doesNotContain(aliceRecipe);
        assertThat(names(null, "/api/recipes")).contains(baseName).doesNotContain(aliceRecipe);

        mockMvc.perform(as(get("/api/recipes"), alice))
                .andExpect(jsonPath("$[?(@.name == '" + aliceRecipe + "')].own").value(hasItem(true)))
                .andExpect(jsonPath("$[?(@.name == '" + baseName + "')].own").value(hasItem(false)))
                .andExpect(jsonPath("$[?(@.name == '" + baseName + "')].saved").value(hasItem(false)));
    }

    @Test
    void hidesRecipeOfAnotherUserAndLetsOnlyTheAuthorChangeIt() throws Exception {
        String alice = bearer();
        String bob = bearer();
        String id = createRecipe(alice, "Private soup");
        String update = "{\"name\":\"Renamed soup\",\"portions\":1,\"ingredients\":[]}";

        mockMvc.perform(as(get("/api/recipes/" + id), bob)).andExpect(status().isNotFound());
        mockMvc.perform(get("/api/recipes/" + id)).andExpect(status().isNotFound());
        mockMvc.perform(as(put("/api/recipes/" + id), bob).contentType(MediaType.APPLICATION_JSON).content(update))
                .andExpect(status().isNotFound());
        mockMvc.perform(as(patch("/api/recipes/" + id + "/archive"), bob)).andExpect(status().isNotFound());
        mockMvc.perform(as(post("/api/recipes/" + id + "/saved"), bob)).andExpect(status().isNotFound());

        mockMvc.perform(as(put("/api/recipes/" + id), alice).contentType(MediaType.APPLICATION_JSON).content(update))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Renamed soup"))
                .andExpect(jsonPath("$.ingredients.length()").value(0))
                .andExpect(jsonPath("$.own").value(true));
    }

    @Test
    void baseRecipesAreReadOnly() throws Exception {
        String token = bearer();
        Recipe base = saveBaseRecipe("Base salad");

        mockMvc.perform(as(get("/api/recipes/" + base.getId()), token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.own").value(false));
        mockMvc.perform(get("/api/recipes/" + base.getId())).andExpect(status().isOk());
        mockMvc.perform(as(put("/api/recipes/" + base.getId()), token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Hacked\"}"))
                .andExpect(status().isForbidden());
        mockMvc.perform(as(patch("/api/recipes/" + base.getId() + "/archive"), token)).andExpect(status().isForbidden());
        mockMvc.perform(as(patch("/api/recipes/" + base.getId() + "/restore"), token)).andExpect(status().isForbidden());

        assertThat(recipeRepository.findById(base.getId()).orElseThrow().getName()).isEqualTo("Base salad");
    }

    @Test
    void archivedRecipeDisappearsFromTheListAndCanBeRestoredByItsAuthor() throws Exception {
        String alice = bearer();
        String bob = bearer();
        String name = "Archived " + UUID.randomUUID();
        String id = createRecipe(alice, name);

        mockMvc.perform(as(patch("/api/recipes/" + id + "/archive"), alice))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.is_archived").value(true));
        assertThat(names(alice, "/api/recipes")).doesNotContain(name);
        mockMvc.perform(as(get("/api/recipes/" + id), alice))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value(name));
        mockMvc.perform(as(patch("/api/recipes/" + id + "/restore"), bob)).andExpect(status().isNotFound());

        mockMvc.perform(as(patch("/api/recipes/" + id + "/restore"), alice))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.is_archived").value(false));
        assertThat(names(alice, "/api/recipes")).contains(name);
    }

    @Test
    void savesAndUnsavesBaseRecipes() throws Exception {
        String token = bearer();
        String other = bearer();
        Recipe base = saveBaseRecipe("Saved base " + UUID.randomUUID());
        String path = "/api/recipes/" + base.getId() + "/saved";

        mockMvc.perform(as(post(path), token)).andExpect(status().isNoContent());
        mockMvc.perform(as(post(path), token)).andExpect(status().isNoContent());

        assertThat(names(token, "/api/recipes/saved")).containsExactly(base.getName());
        assertThat(names(other, "/api/recipes/saved")).isEmpty();
        mockMvc.perform(as(get("/api/recipes/saved"), token)).andExpect(jsonPath("$[0].saved").value(true));
        mockMvc.perform(as(get("/api/recipes/" + base.getId()), token)).andExpect(jsonPath("$.saved").value(true));
        mockMvc.perform(as(get("/api/recipes"), token))
                .andExpect(jsonPath("$[?(@.name == '" + base.getName() + "')].saved").value(hasItem(true)));
        mockMvc.perform(as(get("/api/recipes"), other))
                .andExpect(jsonPath("$[?(@.name == '" + base.getName() + "')].saved").value(not(hasItem(true))));

        mockMvc.perform(as(delete(path), token)).andExpect(status().isNoContent());
        mockMvc.perform(as(delete(path), token)).andExpect(status().isNoContent());
        assertThat(names(token, "/api/recipes/saved")).isEmpty();
    }

    @Test
    void savedListSkipsArchivedRecipes() throws Exception {
        String token = bearer();
        String id = createRecipe(token, "Own saved");
        mockMvc.perform(as(post("/api/recipes/" + id + "/saved"), token)).andExpect(status().isNoContent());
        assertThat(names(token, "/api/recipes/saved")).containsExactly("Own saved");

        mockMvc.perform(as(patch("/api/recipes/" + id + "/archive"), token)).andExpect(status().isOk());

        assertThat(names(token, "/api/recipes/saved")).isEmpty();
        mockMvc.perform(as(post("/api/recipes/" + id + "/saved"), token)).andExpect(status().isNotFound());
    }

    @Test
    void unknownRecipeReturnsNotFound() throws Exception {
        String token = bearer();
        String id = UUID.randomUUID().toString();

        mockMvc.perform(as(get("/api/recipes/" + id), token)).andExpect(status().isNotFound());
        mockMvc.perform(as(patch("/api/recipes/" + id + "/archive"), token)).andExpect(status().isNotFound());
        mockMvc.perform(as(post("/api/recipes/" + id + "/saved"), token)).andExpect(status().isNotFound());
    }

    @Test
    void changingRecipesRequiresAuthentication() throws Exception {
        Recipe base = saveBaseRecipe("Anonymous");

        mockMvc.perform(get("/api/recipes/saved")).andExpect(status().isUnauthorized());
        mockMvc.perform(post("/api/recipes/" + base.getId() + "/saved")).andExpect(status().isUnauthorized());
        mockMvc.perform(delete("/api/recipes/" + base.getId() + "/saved")).andExpect(status().isUnauthorized());
        mockMvc.perform(patch("/api/recipes/" + base.getId() + "/archive")).andExpect(status().isUnauthorized());
        mockMvc.perform(put("/api/recipes/" + base.getId()).contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void planEntriesCanOnlyUseVisibleRecipesAndKeepArchivedOnes() throws Exception {
        String alice = bearer();
        String bob = bearer();
        String id = createRecipe(alice, "Alice dinner");
        String meal = "{\"recipe\":{\"id\":\"" + id + "\"},\"meal_date\":\"2026-10-19\",\"meal_type\":\"dinner\",\"portions_consumed\":1}";

        mockMvc.perform(as(post("/api/meals"), bob).contentType(MediaType.APPLICATION_JSON).content(meal))
                .andExpect(status().isNotFound());
        mockMvc.perform(as(post("/api/meals"), alice).contentType(MediaType.APPLICATION_JSON).content(meal))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.recipe.name").value("Alice dinner"));

        mockMvc.perform(as(patch("/api/recipes/" + id + "/archive"), alice)).andExpect(status().isOk());

        mockMvc.perform(as(get("/api/meals"), alice))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.recipe.id == '" + id + "')].recipe.name").value(hasItem("Alice dinner")));
    }
}
