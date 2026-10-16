package com.mealplanner.server.off;

public record OffProduct(String code, String name, String brand, Double kcal, Double protein, Double fat,
                         Double carbs, String quantity) {
}
