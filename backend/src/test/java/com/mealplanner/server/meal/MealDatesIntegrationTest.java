package com.mealplanner.server.meal;

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

import java.util.UUID;

import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class MealDatesIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private UserRepository userRepository;

    private String bearerForNewUser() {
        User user = new User();
        user.setEmail("meals-" + UUID.randomUUID() + "@example.com");
        user.setPasswordHash("hash");
        user.setRole(UserRole.USER);
        user = userRepository.save(user);
        return "Bearer " + jwtService.generateToken(user.getId(), user.getEmail());
    }

    private void addMeal(String bearer, String date) throws Exception {
        mockMvc.perform(post("/api/meals")
                        .header(HttpHeaders.AUTHORIZATION, bearer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"meal_date\":\"" + date + "\",\"meal_type\":\"breakfast\",\"manual_name\":\"Meal " + date + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.meal_date").value(date));
    }

    @Test
    void returnsMealsWithFullIsoDatesAcrossNewYear() throws Exception {
        String bearer = bearerForNewUser();
        addMeal(bearer, "2026-12-31");
        addMeal(bearer, "2027-01-01");

        mockMvc.perform(get("/api/meals").header(HttpHeaders.AUTHORIZATION, bearer))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].meal_date", containsInAnyOrder("2026-12-31", "2027-01-01")));
    }

    @Test
    void keepsTheSameDayOfDifferentYearsApart() throws Exception {
        String bearer = bearerForNewUser();
        addMeal(bearer, "2026-01-01");
        addMeal(bearer, "2027-01-01");

        mockMvc.perform(get("/api/meals/day/2027-01-01").header(HttpHeaders.AUTHORIZATION, bearer))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].manual_name").value("Meal 2027-01-01"));
    }

    @Test
    void rejectsDatesWithoutTheYear() throws Exception {
        String bearer = bearerForNewUser();

        mockMvc.perform(get("/api/meals/day/16.10").header(HttpHeaders.AUTHORIZATION, bearer))
                .andExpect(status().isBadRequest());
        mockMvc.perform(post("/api/meals")
                        .header(HttpHeaders.AUTHORIZATION, bearer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"meal_date\":\"16.10\",\"meal_type\":\"breakfast\"}"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(post("/api/meals")
                        .header(HttpHeaders.AUTHORIZATION, bearer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"date_str\":\"16.10\",\"meal_type\":\"breakfast\"}"))
                .andExpect(status().isBadRequest());
    }
}
