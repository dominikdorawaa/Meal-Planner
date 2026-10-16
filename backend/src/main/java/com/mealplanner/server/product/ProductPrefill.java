package com.mealplanner.server.product;

import com.mealplanner.server.off.OffProduct;

public record ProductPrefill(String name, String brand, Double kcal, Double protein, Double fat, Double carbs) {

    public static ProductPrefill from(OffProduct product) {
        return new ProductPrefill(product.name(), product.brand(), NutritionRounding.kcal(product.kcal()),
                NutritionRounding.grams(product.protein()), NutritionRounding.grams(product.fat()),
                NutritionRounding.grams(product.carbs()));
    }
}
