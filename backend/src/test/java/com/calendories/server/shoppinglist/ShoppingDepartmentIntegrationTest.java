package com.calendories.server.shoppinglist;

import com.calendories.server.TestcontainersConfiguration;
import com.calendories.server.auth.JwtService;
import com.calendories.server.user.User;
import com.calendories.server.user.UserRepository;
import com.calendories.server.user.UserRole;
import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class ShoppingDepartmentIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ShoppingDepartmentRepository departmentRepository;

    private User saveUser() {
        User user = new User();
        user.setEmail("user-" + UUID.randomUUID() + "@example.com");
        user.setPasswordHash("hash");
        user.setRole(UserRole.USER);
        return userRepository.save(user);
    }

    private ResultActions assign(User user, String body) throws Exception {
        return mockMvc.perform(put("/api/shopping-list/departments/assignments")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + jwtService.generateToken(user.getId(), user.getEmail()))
                .header(HttpHeaders.ACCEPT_LANGUAGE, "en")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body));
    }

    private ResultActions list(User user) throws Exception {
        return mockMvc.perform(get("/api/shopping-list/departments")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + jwtService.generateToken(user.getId(), user.getEmail())));
    }

    @Test
    void remembersTheBuiltInDepartmentForANormalizedProductName() throws Exception {
        User user = saveUser();

        assign(user, "{\"product_name\":\"  Baking \u00a0 PAPER \",\"department\":\"other\"}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.custom", empty()))
                .andExpect(jsonPath("$.assignments[0].product_name").value("baking paper"))
                .andExpect(jsonPath("$.assignments[0].department").value("other"));

        assign(user, "{\"product_name\":\"baking paper\",\"department\":\"bakery\"}").andExpect(status().isOk());

        list(user)
                .andExpect(jsonPath("$.assignments", hasSize(1)))
                .andExpect(jsonPath("$.assignments[0].department").value("bakery"));
    }

    @Test
    void createsACustomDepartmentOnceAndKeepsItWhenNothingUsesIt() throws Exception {
        User user = saveUser();

        String created = assign(user, "{\"product_name\":\"Hummus\",\"new_department_name\":\"  Pet \u00a0 food \"}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.custom[0].name").value("Pet food"))
                .andReturn().getResponse().getContentAsString();
        String id = JsonPath.read(created, "$.custom[0].id");

        assign(user, "{\"product_name\":\"Dog food\",\"new_department_name\":\"pet FOOD\"}")
                .andExpect(jsonPath("$.custom", hasSize(1)))
                .andExpect(jsonPath("$.assignments[*].department", contains(id, id)));

        assign(user, "{\"product_name\":\"dog food\",\"department\":\"other\"}").andExpect(status().isOk());
        assign(user, "{\"product_name\":\"hummus\",\"department\":\"dairy\"}")
                .andExpect(jsonPath("$.custom[0].id").value(id));

        assertThat(departmentRepository.findByUserIdOrderByCreatedAtAscIdAsc(user.getId())).hasSize(1);
    }

    @Test
    void deletesAnOwnDepartmentWithItsRememberedProducts() throws Exception {
        User owner = saveUser();
        User other = saveUser();
        String created = assign(owner, "{\"product_name\":\"Hummus\",\"new_department_name\":\"Deli\"}")
                .andReturn().getResponse().getContentAsString();
        String id = JsonPath.read(created, "$.custom[0].id");
        assign(owner, "{\"product_name\":\"Bread\",\"department\":\"bakery\"}");

        delete(other, id)
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("This department does not exist."));
        delete(owner, "not-an-id").andExpect(status().isNotFound());

        delete(owner, id)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.custom", empty()))
                .andExpect(jsonPath("$.assignments[*].product_name", contains("bread")));
        delete(owner, id).andExpect(status().isNotFound());
    }

    private ResultActions delete(User user, String id) throws Exception {
        return mockMvc.perform(MockMvcRequestBuilders.delete("/api/shopping-list/departments/" + id)
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + jwtService.generateToken(user.getId(), user.getEmail()))
                .header(HttpHeaders.ACCEPT_LANGUAGE, "en"));
    }

    @Test
    void keepsDepartmentsSeparatePerUser() throws Exception {
        User owner = saveUser();
        User other = saveUser();
        String created = assign(owner, "{\"product_name\":\"Hummus\",\"new_department_name\":\"Deli\"}")
                .andReturn().getResponse().getContentAsString();
        String id = JsonPath.read(created, "$.custom[0].id");

        assign(other, "{\"product_name\":\"Hummus\",\"department\":\"" + id + "\"}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("This department does not exist."));
        list(other)
                .andExpect(jsonPath("$.custom", empty()))
                .andExpect(jsonPath("$.assignments", empty()));
    }

    @Test
    void rejectsInvalidRequests() throws Exception {
        User user = saveUser();

        assign(user, "{\"product_name\":\" \",\"department\":\"other\"}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Enter a product name."));
        assign(user, "{\"product_name\":\"" + "a".repeat(256) + "\",\"department\":\"other\"}")
                .andExpect(status().isBadRequest());
        assign(user, "{\"product_name\":\"Hummus\"}")
                .andExpect(jsonPath("$.error").value("This department does not exist."));
        assign(user, "{\"product_name\":\"Hummus\",\"department\":\"snacks\"}")
                .andExpect(jsonPath("$.error").value("This department does not exist."));
        assign(user, "{\"product_name\":\"Hummus\",\"department\":\"" + UUID.randomUUID() + "\"}")
                .andExpect(jsonPath("$.error").value("This department does not exist."));
        assign(user, "{\"product_name\":\"Hummus\",\"new_department_name\":\"  \"}")
                .andExpect(jsonPath("$.error").value("Enter a department name."));
        assign(user, "{\"product_name\":\"Hummus\",\"new_department_name\":\"" + "d".repeat(41) + "\"}")
                .andExpect(jsonPath("$.error").value("A department name can have at most 40 characters."));

        list(user).andExpect(jsonPath("$.assignments", empty()));
    }

    @Test
    void requiresSigningIn() throws Exception {
        mockMvc.perform(get("/api/shopping-list/departments")).andExpect(status().isUnauthorized());
    }
}
