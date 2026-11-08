package com.mealplanner.server;

import com.mealplanner.server.recipe.Recipe;
import com.mealplanner.server.recipe.RecipeStep;
import com.mealplanner.server.shoppinglist.ShoppingListItem;
import com.mealplanner.server.user.UserProfile;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import tools.jackson.databind.ObjectMapper;

import java.util.List;

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
    void readsRecipeStepsAsObjectsOrPlainText() {
        Recipe recipe = objectMapper.readValue(
                "{\"instructions\":[{\"name\":\" Sauce \",\"text\":\"Fry\"},\"Boil\",{\"name\":\" \"}]}",
                Recipe.class);

        assertThat(recipe.getSteps()).containsExactly(
                new RecipeStep("Sauce", "Fry"), new RecipeStep(null, "Boil"), new RecipeStep(null, ""));
    }

    @Test
    void prefersNamedStepsOverPlainTextInstructions() {
        Recipe stepsFirst = objectMapper.readValue(
                "{\"steps\":[{\"name\":\"Sauce\",\"text\":\"Fry\"}],\"instructions\":[\"Fry\"]}", Recipe.class);
        Recipe instructionsFirst = objectMapper.readValue(
                "{\"instructions\":[\"Fry\"],\"steps\":[{\"name\":\"Sauce\",\"text\":\"Fry\"}]}", Recipe.class);

        assertThat(stepsFirst.getSteps()).containsExactly(new RecipeStep("Sauce", "Fry"));
        assertThat(instructionsFirst.getSteps()).containsExactly(new RecipeStep("Sauce", "Fry"));
    }

    @Test
    void writesStepsAsTextForOlderClients() {
        Recipe recipe = new Recipe();
        recipe.setSteps(List.of(new RecipeStep("Sauce", "Fry"), new RecipeStep("Serve", "")));

        var json = objectMapper.valueToTree(recipe);

        assertThat(json.get("steps").get(0).get("name").asString()).isEqualTo("Sauce");
        assertThat(json.get("instructions").get(0).asString()).isEqualTo("Fry");
        assertThat(json.get("instructions").get(1).asString()).isEqualTo("Serve");
        assertThat(objectMapper.valueToTree(new Recipe()).get("instructions").size()).isZero();
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
