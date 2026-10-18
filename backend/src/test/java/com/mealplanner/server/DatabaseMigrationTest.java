package com.mealplanner.server;

import com.mealplanner.server.auth.AuthService;
import com.mealplanner.server.auth.RegisterRequest;
import com.mealplanner.server.product.ProductSearchText;
import com.mealplanner.server.user.ProfileService;
import com.mealplanner.server.user.UserProfile;
import db.migration.V6__fill_product_search_text;
import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.configuration.Configuration;
import org.flywaydb.core.api.migration.Context;
import org.springframework.dao.DataIntegrityViolationException;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

import javax.sql.DataSource;
import java.sql.Connection;
import tools.jackson.databind.ObjectMapper;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

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

        assertThat(history).extracting(row -> row.get("version")).containsExactly("1", "2", "3", "4", "5", "6", "7", "8", "9", "10");
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
    void fillsSearchTextInChunks() throws Exception {
        String schema = "search_chunks_" + UUID.randomUUID().toString().replace("-", "");
        Flyway.configure().dataSource(dataSource).schemas(schema).target("5").load().migrate();
        for (int i = 0; i < 5; i++) {
            jdbcTemplate.update("insert into " + schema + ".products (id, name) values (?, ?)",
                    UUID.randomUUID(), "Żółty ser " + i);
        }

        try (Connection connection = dataSource.getConnection()) {
            String originalSchema = connection.getSchema();
            connection.setSchema(schema);
            try {
                new V6__fill_product_search_text(2).migrate(new Context() {
                    @Override
                    public Configuration getConfiguration() {
                        return null;
                    }

                    @Override
                    public Connection getConnection() {
                        return connection;
                    }
                });
            } finally {
                connection.setSchema(originalSchema);
            }
        }

        assertThat(jdbcTemplate.queryForList("select search_text from " + schema + ".products order by name",
                String.class)).containsExactly("zolty ser 0", "zolty ser 1", "zolty ser 2", "zolty ser 3", "zolty ser 4");
        jdbcTemplate.execute("drop schema " + schema + " cascade");
    }

    @Test
    void fillsSearchTextOfExistingProductsTheSameWayAsNewProducts() {
        String schema = "search_migration_" + UUID.randomUUID().toString().replace("-", "");
        Flyway.configure().dataSource(dataSource).schemas(schema).target("4").load().migrate();
        List<String[]> products = List.of(
                new String[] {"Mājas biezpiens", null},
                new String[] {"Straße Joghurt", "Müller"},
                new String[] {"Żółty ser Łaciaty", "Mlekpol"},
                new String[] {"Øko havregryn", "Ørsted"});
        for (String[] product : products) {
            jdbcTemplate.update("insert into " + schema + ".products (id, name, brand) values (?, ?, ?)",
                    UUID.randomUUID(), product[0], product[1]);
        }

        Flyway.configure().dataSource(dataSource).schemas(schema).load().migrate();

        for (String[] product : products) {
            assertThat(jdbcTemplate.queryForObject(
                    "select search_text from " + schema + ".products where name = ?", String.class, product[0]))
                    .isEqualTo(ProductSearchText.of(product[0], product[1]));
        }
        jdbcTemplate.execute("drop schema " + schema + " cascade");
    }

    @Test
    void marksExistingProductsAsVerifiedUserProductsAndExistingUsersAsRegularUsers() {
        String schema = "status_migration_" + UUID.randomUUID().toString().replace("-", "");
        Flyway.configure().dataSource(dataSource).schemas(schema).target("2").load().migrate();
        jdbcTemplate.update("insert into " + schema + ".app_users (id, email, password_hash) values (?, ?, ?)",
                UUID.randomUUID(), "existing@example.com", "hash");
        jdbcTemplate.update("insert into " + schema + ".products (id, name, bar_code) values (?, ?, ?)",
                UUID.randomUUID(), "Existing product", "5900000000001");

        Flyway.configure().dataSource(dataSource).schemas(schema).load().migrate();

        Map<String, Object> product = jdbcTemplate.queryForMap(
                "select status, source, created_by from " + schema + ".products");
        assertThat(product.get("status")).isEqualTo("VERIFIED");
        assertThat(product.get("source")).isEqualTo("USER");
        assertThat(product.get("created_by")).isNull();
        assertThat(jdbcTemplate.queryForObject("select role from " + schema + ".app_users", String.class))
                .isEqualTo("USER");
        jdbcTemplate.execute("drop schema " + schema + " cascade");
    }

    @Test
    void renamesOpenFoodFactsSourceAndRoundsNutritionOfExistingProducts() {
        String schema = "rounding_migration_" + UUID.randomUUID().toString().replace("-", "");
        Flyway.configure().dataSource(dataSource).schemas(schema).target("6").load().migrate();
        jdbcTemplate.update("insert into " + schema + ".products (id, name, source, kcal, protein, fat, carbs) "
                        + "values (?, ?, 'OFF', 64.6, 12.0400009, 0.04, 4.19999980927), (?, ?, 'USER', null, null, null, null)",
                UUID.randomUUID(), "From Open Food Facts", UUID.randomUUID(), "Empty");

        Flyway.configure().dataSource(dataSource).schemas(schema).load().migrate();

        Map<String, Object> product = jdbcTemplate.queryForMap("select source, kcal, protein, fat, carbs from "
                + schema + ".products where name = 'From Open Food Facts'");
        assertThat(product.get("source")).isEqualTo("OPEN_FOOD_FACTS");
        assertThat(product.get("kcal")).isEqualTo(65.0);
        assertThat(product.get("protein")).isEqualTo(12.0);
        assertThat(product.get("fat")).isEqualTo(0.0);
        assertThat(product.get("carbs")).isEqualTo(4.2);
        assertThat(jdbcTemplate.queryForObject("select kcal from " + schema + ".products where name = 'Empty'", Double.class))
                .isNull();
        assertThatThrownBy(() -> jdbcTemplate.update("insert into " + schema + ".products (id, name, source) values (?, ?, 'OFF')",
                UUID.randomUUID(), "Old source"))
                .isInstanceOf(DataIntegrityViolationException.class);
        jdbcTemplate.execute("drop schema " + schema + " cascade");
    }

    @Test
    void storesExistingMealDatesWithTheYearClosestToTheirCreationTime() {
        String schema = "meal_date_migration_" + UUID.randomUUID().toString().replace("-", "");
        Flyway.configure().dataSource(dataSource).schemas(schema).target("7").load().migrate();
        UUID userId = UUID.randomUUID();
        jdbcTemplate.update("insert into " + schema + ".app_users (id, email, password_hash) values (?, ?, ?)",
                userId, "meals@example.com", "hash");
        String[][] meals = {
                {"same-year", "16.10", "2026-10-15 12:00:00+02"},
                {"next-year", "02.01", "2025-12-30 12:00:00+01"},
                {"previous-year", "30.12", "2026-01-02 12:00:00+01"},
                {"leap-day", "29.02", "2028-02-20 12:00:00+01"},
                {"leap-day-of-previous-year", "29.02", "2025-03-10 12:00:00+01"},
                {"late-evening", "01.01", "2025-12-31 23:30:00+00"},
                {"invalid", "31.02", "2026-05-05 12:00:00+02"},
                {"no-creation-time", "abc", null}};
        for (String[] meal : meals) {
            jdbcTemplate.update("insert into " + schema + ".user_meals (id, user_id, date_str, meal_type, manual_name, created_at) "
                    + "values (?, ?, ?, 'breakfast', ?, ?::timestamptz)", UUID.randomUUID(), userId, meal[1], meal[0], meal[2]);
        }

        Flyway.configure().dataSource(dataSource).schemas(schema).load().migrate();

        Map<String, String> dates = new HashMap<>();
        jdbcTemplate.queryForList("select manual_name, meal_date::text as meal_date from " + schema + ".user_meals")
                .forEach(row -> dates.put((String) row.get("manual_name"), (String) row.get("meal_date")));
        assertThat(dates).containsEntry("same-year", "2026-10-16")
                .containsEntry("next-year", "2026-01-02")
                .containsEntry("previous-year", "2025-12-30")
                .containsEntry("leap-day", "2028-02-29")
                .containsEntry("leap-day-of-previous-year", "2024-02-29")
                .containsEntry("late-evening", "2026-01-01")
                .containsEntry("invalid", "2026-05-05");
        assertThat(dates.get("no-creation-time")).isNotNull();
        assertThat(jdbcTemplate.queryForList("select column_name from information_schema.columns where table_schema = ? "
                + "and table_name = 'user_meals' and column_name = 'date_str'", String.class, schema)).isEmpty();
        assertThatThrownBy(() -> jdbcTemplate.update("insert into " + schema + ".user_meals (id, user_id, meal_type) "
                + "values (?, ?, 'breakfast')", UUID.randomUUID(), userId))
                .isInstanceOf(DataIntegrityViolationException.class);
        jdbcTemplate.execute("drop schema " + schema + " cascade");
    }

    @Test
    void allowsManyUnverifiedProductsWithTheSameBarCodeButOnlyOneVerified() {
        String barCode = "test-" + UUID.randomUUID();
        insertProduct(barCode, "PENDING");
        insertProduct(barCode, "PENDING");
        insertProduct(barCode, "REJECTED");
        insertProduct(barCode, "VERIFIED");

        assertThatThrownBy(() -> insertProduct(barCode, "VERIFIED"))
                .isInstanceOf(DataIntegrityViolationException.class);
        assertThat(jdbcTemplate.queryForObject(
                "select count(*) from products where bar_code = ?", Integer.class, barCode)).isEqualTo(4);
        jdbcTemplate.update("delete from products where bar_code = ?", barCode);
    }

    @Test
    void rejectsUnknownProductStatusSourceAndUserRole() {
        assertThatThrownBy(() -> insertProduct("5900000000002", "UNKNOWN"))
                .isInstanceOf(DataIntegrityViolationException.class);
        assertThatThrownBy(() -> jdbcTemplate.update(
                "insert into products (id, name, source) values (?, ?, ?)", UUID.randomUUID(), "Bad source", "SHOP"))
                .isInstanceOf(DataIntegrityViolationException.class);
        assertThatThrownBy(() -> jdbcTemplate.update(
                "insert into app_users (id, email, password_hash, role) values (?, ?, ?, ?)",
                UUID.randomUUID(), uniqueEmail(), "hash", "OWNER"))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void keepsProductWithoutCreatorWhenCreatorIsDeleted() {
        UUID userId = UUID.randomUUID();
        UUID productId = UUID.randomUUID();
        jdbcTemplate.update("insert into app_users (id, email, password_hash) values (?, ?, ?)",
                userId, uniqueEmail(), "hash");
        jdbcTemplate.update("insert into products (id, name, created_by) values (?, ?, ?)",
                productId, "Created product", userId);

        jdbcTemplate.update("delete from app_users where id = ?", userId);

        Map<String, Object> product = jdbcTemplate.queryForMap(
                "select name, created_by from products where id = ?", productId);
        assertThat(product.get("name")).isEqualTo("Created product");
        assertThat(product.get("created_by")).isNull();
        jdbcTemplate.update("delete from products where id = ?", productId);
    }

    @Test
    void rejectsProductWithUnknownCreator() {
        assertThatThrownBy(() -> jdbcTemplate.update(
                "insert into products (id, name, created_by) values (?, ?, ?)",
                UUID.randomUUID(), "Orphan product", UUID.randomUUID()))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    private void insertProduct(String barCode, String status) {
        jdbcTemplate.update("insert into products (id, name, bar_code, status) values (?, ?, ?, ?)",
                UUID.randomUUID(), "Product " + status, barCode, status);
    }

    private String uniqueEmail() {
        return "user-" + UUID.randomUUID() + "@example.com";
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
