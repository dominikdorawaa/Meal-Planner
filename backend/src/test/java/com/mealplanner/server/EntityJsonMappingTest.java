package com.mealplanner.server;

import com.mealplanner.server.recipe.Recipe;
import com.mealplanner.server.shoppinglist.ShoppingListItem;
import com.mealplanner.server.user.UserProfile;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import tools.jackson.databind.ObjectMapper;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@Import(TestcontainersConfiguration.class)
class EntityJsonMappingTest {

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void readsPartialProfileUpdateWithoutInternalFlags() {
        UserProfile profile = objectMapper.readValue("{\"display_name\":\"Ania\"}", UserProfile.class);

        assertThat(profile.getDisplayName()).isEqualTo("Ania");
        assertThat(profile.isNew()).isFalse();
        assertThat(profile.getIsManualMacros()).isFalse();
    }

    @Test
    void readsMealConfigAsJson() {
        UserProfile profile = objectMapper.readValue(
                "{\"meal_config\":[{\"id\":\"breakfast\",\"name\":\"Sniadanie\",\"visible\":true}]}",
                UserProfile.class);

        assertThat(profile.getMealConfig().get(0).get("name").asString()).isEqualTo("Sniadanie");
        assertThat(profile.getMealConfig().get(0).get("visible").asBoolean()).isTrue();
    }

    @Test
    void keepsDefaultValuesForFieldsMissingInRecipeJson() {
        Recipe recipe = objectMapper.readValue("{\"name\":\"Owsianka\"}", Recipe.class);

        assertThat(recipe.getKcal()).isEqualTo(0.0);
        assertThat(recipe.getPortions()).isEqualTo(1.0);
        assertThat(recipe.getPrepTime()).isEqualTo(0);
        assertThat(recipe.getIsArchived()).isFalse();
    }

    @Test
    void keepsShoppingListItemUncheckedByDefault() {
        ShoppingListItem item = objectMapper.readValue("{\"ingredient_name\":\"Mleko\"}", ShoppingListItem.class);

        assertThat(item.getIngredientName()).isEqualTo("Mleko");
        assertThat(item.getIsChecked()).isFalse();
    }

    @Test
    void writesSnakeCaseNamesExpectedByTheFrontend() {
        UserProfile profile = new UserProfile();
        profile.setDisplayName("Ania");
        profile.setTargetWeight(60.0);

        String json = objectMapper.writeValueAsString(profile);

        assertThat(json).contains("\"display_name\":\"Ania\"", "\"target_weight\":60.0");
        assertThat(json).doesNotContain("displayName", "new_profile", "\"new\"");
    }
}
