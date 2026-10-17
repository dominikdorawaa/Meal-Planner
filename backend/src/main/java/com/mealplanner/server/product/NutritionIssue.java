package com.mealplanner.server.product;

import java.util.Locale;

public enum NutritionIssue {
    NAME_MISSING(true),
    NUTRIENT_MISSING(true),
    NEGATIVE_VALUE(true),
    KCAL_ABOVE_900(true),
    MACRO_ABOVE_100G(true),
    MACROS_SUM_ABOVE_100G(true),
    KCAL_LOOKS_LIKE_KJ(true),
    KCAL_MISMATCH(false),
    INVALID_BAR_CODE(true),
    SATURATED_FAT_ABOVE_FAT(true),
    SUGARS_ABOVE_CARBS(true),
    KCAL_DEVIATION(false);

    private final boolean error;

    NutritionIssue(boolean error) {
        this.error = error;
    }

    public boolean isError() {
        return error;
    }

    public String messageKey() {
        return "product.nutrition." + name().toLowerCase(Locale.ROOT).replace('_', '-');
    }
}
