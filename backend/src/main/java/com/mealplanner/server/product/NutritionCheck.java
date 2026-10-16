package com.mealplanner.server.product;

import java.util.List;

public record NutritionCheck(List<NutritionIssue> errors, List<NutritionIssue> warnings) {

    public boolean isValid() {
        return errors.isEmpty();
    }
}
