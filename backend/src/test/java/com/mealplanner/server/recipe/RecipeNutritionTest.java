package com.mealplanner.server.recipe;

import com.mealplanner.server.product.MeasureKind;
import com.mealplanner.server.product.Product;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class RecipeNutritionTest {

    private static Product product(String unit, Double kcal, Double protein, Double fat, Double carbs) {
        Product product = new Product();
        product.setName("Product");
        product.setUnit(unit);
        product.setKcal(kcal);
        product.setProtein(protein);
        product.setFat(fat);
        product.setCarbs(carbs);
        return product;
    }

    private static RecipeIngredient ingredient(Product product, Double amount, String unit) {
        RecipeIngredient ingredient = new RecipeIngredient();
        ingredient.setName("Ingredient");
        ingredient.setProduct(product);
        ingredient.setAmount(amount);
        ingredient.setUnit(unit);
        return ingredient;
    }

    private static MeasureKind kind(String code) {
        MeasureKind kind = new MeasureKind();
        kind.setCode(code);
        kind.setNames(Map.of());
        kind.setMaxAmount(10.0);
        kind.setMaxBaseAmount(1000.0);
        kind.setSortOrder(1);
        return kind;
    }

    @Test
    void scalesProductNutritionToTheAmountInGrams() {
        Product oats = product("100g", 370.0, 13.2, 7.0, 60.0);

        assertThat(RecipeNutrition.of(ingredient(oats, 50.0, "g")))
                .contains(new RecipeNutrition(185, 6.6, 3.5, 30));
    }

    @Test
    void convertsMeasuresAndPiecesToNutrition() {
        Product banana = product("100g", 89.0, 1.1, 0.3, 23.0);
        banana.addMeasure(kind("piece"), 120);
        Product egg = product("pc", 70.0, 6.0, 5.0, 0.5);

        assertThat(RecipeNutrition.of(ingredient(banana, 2.0, "piece")))
                .contains(new RecipeNutrition(214, 2.6, 0.7, 55.2));
        assertThat(RecipeNutrition.of(ingredient(egg, 3.0, "piece")))
                .contains(new RecipeNutrition(210, 18, 15, 1.5));
    }

    @Test
    void treatsMissingMacrosAsZero() {
        Product water = product("100ml", 0.0, null, null, null);

        assertThat(RecipeNutrition.of(ingredient(water, 250.0, "ml"))).contains(new RecipeNutrition(0, 0, 0, 0));
    }

    @Test
    void hasNoNutritionWithoutAProductOrAKnownMeasure() {
        Product oats = product("100g", 370.0, 13.0, 7.0, 60.0);

        assertThat(RecipeNutrition.of(ingredient(null, 20.0, "g"))).isEmpty();
        assertThat(RecipeNutrition.of(ingredient(oats, 2.0, "tbsp"))).isEmpty();
        assertThat(RecipeNutrition.of(ingredient(oats, null, "g"))).isEmpty();
        assertThat(RecipeNutrition.of(ingredient(product("100g", null, 1.0, 1.0, 1.0), 20.0, "g"))).isEmpty();
    }

    @Test
    void sumsKnownIngredientsAndDividesByPortions() {
        Product oats = product("100g", 370.0, 13.0, 7.0, 60.0);
        Product milk = product("100ml", 64.0, 3.4, 3.2, 4.8);
        List<RecipeIngredient> ingredients = List.of(
                ingredient(oats, 100.0, "g"), ingredient(milk, 300.0, "ml"), ingredient(null, 5.0, "g"));

        assertThat(RecipeNutrition.perPortion(ingredients, 2.0))
                .contains(new RecipeNutrition(281, 11.6, 8.3, 37.2));
        assertThat(RecipeNutrition.perPortion(ingredients, 0.0))
                .contains(new RecipeNutrition(562, 23.2, 16.6, 74.4));
        assertThat(RecipeNutrition.perPortion(ingredients, null))
                .contains(new RecipeNutrition(562, 23.2, 16.6, 74.4));
    }

    @Test
    void hasNoRecipeNutritionWithoutKnownIngredients() {
        assertThat(RecipeNutrition.perPortion(null, 2.0)).isEmpty();
        assertThat(RecipeNutrition.perPortion(List.of(ingredient(null, 5.0, "g")), 2.0)).isEmpty();
    }

    @Test
    void recipeFallsBackToStoredNutritionWithoutKnownIngredients() {
        Recipe stored = new Recipe();
        stored.setKcal(500.0);
        stored.setProtein(20.0);
        stored.setFat(10.0);
        stored.setCarbs(60.0);
        Recipe recipe = new Recipe();
        recipe.copyStoredNutrition(stored);
        recipe.setIngredients(List.of(ingredient(null, 5.0, "g")));

        assertThat(List.of(recipe.getKcal(), recipe.getProtein(), recipe.getFat(), recipe.getCarbs()))
                .containsExactly(500.0, 20.0, 10.0, 60.0);
    }

    @Test
    void recipeUsesCurrentProductNutrition() {
        Product oats = product("100g", 370.0, 13.0, 7.0, 60.0);
        Recipe recipe = new Recipe();
        recipe.setKcal(1.0);
        recipe.setPortions(2.0);
        recipe.setIngredients(List.of(ingredient(oats, 100.0, "g")));

        oats.setKcal(380.0);

        assertThat(List.of(recipe.getKcal(), recipe.getProtein(), recipe.getFat(), recipe.getCarbs()))
                .containsExactly(190.0, 6.5, 3.5, 30.0);
    }
}
