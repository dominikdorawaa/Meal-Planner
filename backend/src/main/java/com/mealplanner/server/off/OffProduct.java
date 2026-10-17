package com.mealplanner.server.off;

import com.mealplanner.server.product.ExtraNutrients;

public record OffProduct(String code, String name, String brand, Double kcal, Double protein, Double fat,
                         Double carbs, ExtraNutrients extras, String quantity, boolean polishName) {
}
