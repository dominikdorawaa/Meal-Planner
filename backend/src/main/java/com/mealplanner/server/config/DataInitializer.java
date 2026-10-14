package com.mealplanner.server.config;

import com.mealplanner.server.product.Product;
import com.mealplanner.server.product.ProductRepository;
import com.mealplanner.server.recipe.Recipe;
import com.mealplanner.server.recipe.RecipeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.Arrays;

@Component
@RequiredArgsConstructor
public class DataInitializer implements CommandLineRunner {

    private final RecipeRepository recipeRepository;
    private final ProductRepository productRepository;

    @Override
    @Transactional
    public void run(String... args) throws Exception {
        seedRecipes();
        seedProducts();
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

    private void seedProducts() {
        if (productRepository.count() == 0) {
            System.out.println("DEBUG: Seeding sample products...");
            productRepository.saveAll(Arrays.asList(
                    createProduct("Kurczak Pierś", "Biedronka", 110.0, 23.0, 1.2, 0.0, "100g", "5901234567890"),
                    createProduct("Skyr Naturalny", "Piątnica", 65.0, 12.0, 0.0, 4.2, "100g", "5901234567891"),
                    createProduct("Chleb Żytni", "Lidl", 260.0, 9.0, 2.0, 48.0, "100g", "5901234567892"),
                    createProduct("Awokado", "Global", 160.0, 2.0, 15.0, 9.0, "100g", "5901234567893"),
                    createProduct("Banan", "Global", 89.0, 1.1, 0.3, 23.0, "100g", "5901234567894")));
            System.out.println("DEBUG: Seeding products complete.");
        }
    }

    private Product createProduct(String name, String brand, Double kcal, Double protein, Double fat, Double carbs,
            String unit, String barCode) {
        Product p = new Product();
        p.setName(name);
        p.setBrand(brand);
        p.setKcal(kcal);
        p.setProtein(protein);
        p.setFat(fat);
        p.setCarbs(carbs);
        p.setUnit(unit);
        p.setBarCode(barCode);
        return p;
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
        r.setInstructions(Arrays.asList("Krok 1: Przygotuj składniki", "Krok 2: Połącz i podawaj"));
        return r;
    }
}
