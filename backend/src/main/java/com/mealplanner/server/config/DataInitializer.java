package com.mealplanner.server.config;

import com.mealplanner.server.product.Product;
import com.mealplanner.server.product.ProductRepository;
import com.mealplanner.server.product.ProductSource;
import com.mealplanner.server.recipe.Recipe;
import com.mealplanner.server.recipe.RecipeIngredient;
import com.mealplanner.server.recipe.RecipeRepository;
import com.mealplanner.server.recipe.RecipeVisibility;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.stream.Stream;

@Component
@Profile("dev")
@RequiredArgsConstructor
public class DataInitializer implements CommandLineRunner {

    private static final List<SampleRecipe> SAMPLE_RECIPES = List.of(
            new SampleRecipe("Sourdough & Avo", List.of(
                    new SampleIngredient("Chleb pszenny", 100, "g"),
                    new SampleIngredient("Awokado", 80, "g"),
                    new SampleIngredient("Jajko", 50, "g"))),
            new SampleRecipe("Berry Smoothie", List.of(
                    new SampleIngredient("Truskawki", 100, "g"),
                    new SampleIngredient("Borówki amerykańskie", 80, "g"),
                    new SampleIngredient("Banan", 100, "g"),
                    new SampleIngredient("Kefir", 200, "ml"))),
            new SampleRecipe("Scrambled Eggs", List.of(
                    new SampleIngredient("Jajko", 150, "g"),
                    new SampleIngredient("Masło", 10, "g"),
                    new SampleIngredient("Chleb pszenny", 50, "g"))),
            new SampleRecipe("Chicken Salad", List.of(
                    new SampleIngredient("Pierś z kurczaka", 150, "g"),
                    new SampleIngredient("Sałata masłowa", 80, "g"),
                    new SampleIngredient("Pomidor", 100, "g"),
                    new SampleIngredient("Oliwa z oliwek", 10, "ml"))),
            new SampleRecipe("Quinoa Bowl", List.of(
                    new SampleIngredient("Kasza jaglana", 80, "g"),
                    new SampleIngredient("Ciecierzyca konserwowa", 100, "g"),
                    new SampleIngredient("Awokado", 50, "g"),
                    new SampleIngredient("Pomidorki koktajlowe", 80, "g"))),
            new SampleRecipe("Pasta Pesto", List.of(
                    new SampleIngredient("Makaron pszenny", 120, "g"),
                    new SampleIngredient("Parmezan", 20, "g"),
                    new SampleIngredient("Oliwa z oliwek", 15, "ml"),
                    new SampleIngredient("Orzechy włoskie", 15, "g"))),
            new SampleRecipe("Baked Salmon", List.of(
                    new SampleIngredient("Łosoś", 200, "g"),
                    new SampleIngredient("Ziemniaki", 250, "g"),
                    new SampleIngredient("Brokuł", 150, "g"),
                    new SampleIngredient("Oliwa z oliwek", 10, "ml"))));

    private final RecipeRepository recipeRepository;
    private final ProductRepository productRepository;

    @Override
    @Transactional
    public void run(String... args) throws Exception {
        seedRecipes();
    }

    private void seedRecipes() {
        if (recipeRepository.count() == 0) {
            System.out.println("DEBUG: Seeding sample recipes...");
            Map<String, Product> products = basicProducts();
            recipeRepository.saveAll(SAMPLE_RECIPES.stream().map(sample -> createRecipe(sample, products)).toList());
            System.out.println("DEBUG: Seeding recipes complete.");
        }
    }

    private Map<String, Product> basicProducts() {
        List<String> names = SAMPLE_RECIPES.stream()
                .flatMap(recipe -> recipe.ingredients().stream())
                .map(SampleIngredient::product)
                .distinct()
                .toList();
        return productRepository.findBySourceAndNameInAndDeletedAtIsNull(ProductSource.BASIC, names).stream()
                .collect(Collectors.toMap(Product::getName, Function.identity(), (first, second) -> first));
    }

    private Recipe createRecipe(SampleRecipe sample, Map<String, Product> products) {
        Recipe r = new Recipe();
        r.setName(sample.name());
        r.setPortions(1.0);
        r.setPrepTime(20);
        r.setIsArchived(false);
        r.setVisibility(RecipeVisibility.PUBLIC);
        r.setInstructions(Arrays.asList("Krok 1: Przygotuj składniki", "Krok 2: Połącz i podawaj"));
        r.setIngredients(sample.ingredients().stream()
                .flatMap(ingredient -> Stream.ofNullable(products.get(ingredient.product()))
                        .map(product -> createIngredient(r, ingredient, product)))
                .collect(Collectors.toList()));
        return r;
    }

    private static RecipeIngredient createIngredient(Recipe recipe, SampleIngredient sample, Product product) {
        RecipeIngredient ingredient = new RecipeIngredient();
        ingredient.setRecipe(recipe);
        ingredient.setName(product.getName());
        ingredient.setAmount(sample.amount());
        ingredient.setUnit(sample.unit());
        ingredient.setProduct(product);
        return ingredient;
    }

    private record SampleRecipe(String name, List<SampleIngredient> ingredients) {
    }

    private record SampleIngredient(String product, double amount, String unit) {
    }
}
