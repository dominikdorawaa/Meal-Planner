package com.mealplanner.server;

import com.mealplanner.server.auth.AuthService;
import com.mealplanner.server.auth.RegisterRequest;
import com.mealplanner.server.user.ProfileService;
import com.mealplanner.server.user.UserProfile;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

import javax.sql.DataSource;
import tools.jackson.databind.ObjectMapper;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@Import(TestcontainersConfiguration.class)
@ActiveProfiles("dev")
class DatabaseMigrationTest {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private AuthService authService;

    @Autowired
    private ProfileService profileService;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private DataSource dataSource;

    private String registerNewUser() {
        RegisterRequest request = new RegisterRequest();
        request.setEmail("new-user-" + UUID.randomUUID() + "@example.com");
        request.setName("New User");
        request.setPassword("example-password");
        authService.register(request);
        return request.getEmail();
    }

    @Test
    void appliesInitialMigrationOnEmptyDatabase() {
        List<Map<String, Object>> history = jdbcTemplate.queryForList(
                "select version, success from flyway_schema_history where version is not null order by installed_rank");

        assertThat(history).extracting(row -> row.get("version")).containsExactly("1", "2");
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
    void seedsSampleRecipesWithoutImageUrls() {
        assertThat(jdbcTemplate.queryForObject("select count(*) from recipes where image_url is not null", Integer.class))
                .isZero();
    }

    @Test
    void clearsLoremFlickrImageUrlsAndKeepsCustomOnes() {
        String schema = "image_migration_" + UUID.randomUUID().toString().replace("-", "");
        Flyway.configure().dataSource(dataSource).schemas(schema).target("1").load().migrate();
        jdbcTemplate.update("insert into " + schema + ".recipes (id, name, image_url) values (?, ?, ?), (?, ?, ?)",
                UUID.randomUUID(), "Old fallback", "https://loremflickr.com/800/533/pasta,pesto?lock=106",
                UUID.randomUUID(), "Custom photo", "https://example.com/my-photo.jpg");

        Flyway.configure().dataSource(dataSource).schemas(schema).load().migrate();

        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                "select name, image_url from " + schema + ".recipes order by name");
        assertThat(rows).extracting(row -> row.get("image_url"))
                .containsExactly("https://example.com/my-photo.jpg", null);
        jdbcTemplate.execute("drop schema " + schema + " cascade");
    }

    @Test
    void newUserGetsAnEmptyProfileBeforeOnboarding() {
        String email = registerNewUser();

        UserProfile profile = profileService.getProfileByEmail(email).orElseThrow();

        assertThat(profile.getId()).isNotNull();
        assertThat(profile.getGender()).isNull();
        assertThat(profile.getAge()).isNull();
        assertThat(profile.getWeight()).isNull();
    }

    @Test
    void storesMealSettingsInJsonColumns() {
        String email = registerNewUser();
        profileService.getProfileByEmail(email);
        UserProfile update = objectMapper.readValue(
                "{\"meal_config\":[{\"id\":\"breakfast\",\"name\":\"Sniadanie\",\"visible\":true},"
                        + "{\"id\":\"lunch\",\"name\":\"Lunch\",\"visible\":false}],"
                        + "\"visible_meals\":[\"breakfast\"]}",
                UserProfile.class);

        profileService.saveProfile(email, update);
        UserProfile stored = profileService.getProfileByEmail(email).orElseThrow();

        assertThat(stored.getMealConfig()).hasSize(2);
        assertThat(stored.getMealConfig().get(0).get("name").asString()).isEqualTo("Sniadanie");
        assertThat(stored.getMealConfig().get(1).get("visible").asBoolean()).isFalse();
        assertThat(stored.getVisibleMeals().get(0).asString()).isEqualTo("breakfast");
        String rawJson = jdbcTemplate.queryForObject(
                "select meal_config::text from user_profiles where id = ?", String.class, stored.getId());
        assertThat(rawJson).contains("\"name\": \"Sniadanie\"");
    }
}
