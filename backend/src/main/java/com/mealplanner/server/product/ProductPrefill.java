package com.mealplanner.server.product;

import com.mealplanner.server.off.OffProduct;

public record ProductPrefill(String name, String brand, Double kcal, Double protein, Double fat, Double carbs,
                             Double saturatedFat, Double sugars, Double fiber, Double salt) {

    public static ProductPrefill from(OffProduct product) {
        Double fat = NutritionRounding.grams(product.fat());
        Double carbs = NutritionRounding.grams(product.carbs());
        ExtraNutrients extras = product.extras().rounded().plausibleFor(fat, carbs);
        return new ProductPrefill(product.name(), product.brand(), NutritionRounding.kcal(product.kcal()),
                NutritionRounding.grams(product.protein()), fat, carbs, extras.saturatedFat(), extras.sugars(),
                extras.fiber(), extras.salt());
    }
}
