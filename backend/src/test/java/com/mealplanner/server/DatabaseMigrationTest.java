package com.mealplanner.server;

import com.mealplanner.server.auth.AuthService;
import com.mealplanner.server.auth.RegisterRequest;
import com.mealplanner.server.user.ProfileService;
import com.mealplanner.server.user.UserProfile;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@Import(TestcontainersConfiguration.class)
class DatabaseMigrationTest {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private AuthService authService;

    @Autowired
    private ProfileService profileService;

    @Test
    void appliesInitialMigrationOnEmptyDatabase() {
        List<Map<String, Object>> history = jdbcTemplate.queryForList(
                "select version, success from flyway_schema_history where version is not null order by installed_rank");

        assertThat(history).extracting(row -> row.get("version")).containsExactly("1");
        assertThat(history).allSatisfy(row -> assertThat(row.get("success")).isEqualTo(true));
    }

    @Test
    void createsAllApplicationTables() {
        List<String> tables = jdbcTemplate.queryForList(
                "select table_name from information_schema.tables where table_schema = 'public' and table_name <> 'flyway_schema_history'",
                String.class);

        assertThat(tables).containsExactlyInAnyOrder(
                "app_users",
                "user_profiles",
                "products",
                "recipes",
                "recipe_ingredients",
                "user_meals",
                "shopping_list",
                "shopping_list_recipes");
    }

    @Test
    void seedsSampleRecipesAndProducts() {
        assertThat(jdbcTemplate.queryForObject("select count(*) from recipes", Integer.class)).isEqualTo(7);
        assertThat(jdbcTemplate.queryForObject("select count(*) from products", Integer.class)).isEqualTo(5);
    }

    @Test
    void newUserGetsAnEmptyProfileBeforeOnboarding() {
        RegisterRequest request = new RegisterRequest();
        request.setEmail("new-user-" + UUID.randomUUID() + "@example.com");
        request.setName("New User");
        request.setPassword("example-password");
        authService.register(request);

        UserProfile profile = profileService.getProfileByEmail(request.getEmail()).orElseThrow();

        assertThat(profile.getId()).isNotNull();
        assertThat(profile.getGender()).isNull();
        assertThat(profile.getAge()).isNull();
        assertThat(profile.getWeight()).isNull();
    }
}
