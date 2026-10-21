package com.mealplanner.server.config;

import com.mealplanner.server.recipe.Recipe;
import com.mealplanner.server.recipe.RecipeRepository;
import com.mealplanner.server.recipe.RecipeVisibility;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.Arrays;

@Component
@Profile("dev")
@RequiredArgsConstructor
public class DataInitializer implements CommandLineRunner {

    private final RecipeRepository recipeRepository;

    @Override
    @Transactional
    public void run(String... args) throws Exception {
        seedRecipes();
    }

    private void seedRecipes() {
        if (recipeRepository.count() == 0) {
            System.out.println("DEBUG: Seeding sample recipes...");
            recipeRepository.saveAll(Arrays.asList(
                    createRecipe("Sourdough & Avo", 510.0, 15.0, 35.0, 40.0),
                    createRecipe("Berry Smoothie", 310.0, 8.0, 10.0, 45.0),
                    createRecipe("Scrambled Eggs", 400.0, 40.0, 11.0, 5.0),
                    createRecipe("Chicken Salad", 410.0, 50.0, 20.0, 15.0),
                    createRecipe("Quinoa Bowl", 450.0, 30.0, 30.0, 40.0),
                    createRecipe("Pasta Pesto", 800.0, 40.0, 10.0, 85.0),
                    createRecipe("Baked Salmon", 900.0, 80.0, 60.0, 20.0)));
            System.out.println("DEBUG: Seeding recipes complete.");
        }
    }

    private Recipe createRecipe(String name, Double kcal, Double protein, Double fat, Double carbs) {
        Recipe r = new Recipe();
        r.setName(name);
        r.setKcal(kcal);
        r.setProtein(protein);
        r.setFat(fat);
        r.setCarbs(carbs);
        r.setPortions(1.0);
        r.setPrepTime(20);
        r.setIsArchived(false);
        r.setVisibility(RecipeVisibility.PUBLIC);
        r.setInstructions(Arrays.asList("Krok 1: Przygotuj składniki", "Krok 2: Połącz i podawaj"));
        return r;
    }
}
