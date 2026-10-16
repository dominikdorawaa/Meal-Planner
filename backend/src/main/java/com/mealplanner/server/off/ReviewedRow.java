package com.mealplanner.server.off;

public record ReviewedRow(int rowNumber, String code, String name, String brand, Double kcal, Double protein,
                          Double fat, Double carbs, String unit, boolean selected) {
}
