package com.mealplanner.server.product;

public final class NutritionRounding {

    private NutritionRounding() {
    }

    public static Double kcal(Double value) {
        return value == null ? null : (double) Math.round(value);
    }

    public static Double grams(Double value) {
        return value == null ? null : Math.round(value * 10) / 10.0;
    }
}
