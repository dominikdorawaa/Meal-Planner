package com.mealplanner.server.recipe;

import com.mealplanner.server.product.Product;

import java.util.List;
import java.util.Optional;

record RecipeNutrition(double kcal, double protein, double fat, double carbs) {

    private static final RecipeNutrition ZERO = new RecipeNutrition(0, 0, 0, 0);

    static Optional<RecipeNutrition> perPortion(List<RecipeIngredient> ingredients, Double portions) {
        if (ingredients == null) {
            return Optional.empty();
        }
        List<RecipeNutrition> known = ingredients.stream()
                .map(RecipeNutrition::of)
                .flatMap(Optional::stream)
                .toList();
        if (known.isEmpty()) {
            return Optional.empty();
        }
        RecipeNutrition total = known.stream().reduce(ZERO, RecipeNutrition::plus);
        double count = portions != null && portions > 0 ? portions : 1;
        return Optional.of(new RecipeNutrition(Math.round(total.kcal / count), tenths(total.protein / count),
                tenths(total.fat / count), tenths(total.carbs / count)));
    }

    static Optional<RecipeNutrition> of(RecipeIngredient ingredient) {
        Product product = ingredient.getProduct();
        if (product == null || product.getKcal() == null || ingredient.getAmount() == null) {
            return Optional.empty();
        }
        Double factor = product.nutritionFactor(ingredient.getUnit(), ingredient.getAmount());
        if (factor == null) {
            return Optional.empty();
        }
        return Optional.of(new RecipeNutrition(Math.round(product.getKcal() * factor),
                tenths(valueOf(product.getProtein()) * factor), tenths(valueOf(product.getFat()) * factor),
                tenths(valueOf(product.getCarbs()) * factor)));
    }

    private RecipeNutrition plus(RecipeNutrition other) {
        return new RecipeNutrition(kcal + other.kcal, protein + other.protein, fat + other.fat, carbs + other.carbs);
    }

    private static double valueOf(Double value) {
        return value == null ? 0 : value;
    }

    private static double tenths(double value) {
        return Math.round(value * 10) / 10.0;
    }
}
