package com.mealplanner.server.product;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class NutritionRoundingTest {

    @Test
    void roundsCaloriesToWholeNumbers() {
        assertThat(NutritionRounding.kcal(64.6)).isEqualTo(65.0);
        assertThat(NutritionRounding.kcal(64.4)).isEqualTo(64.0);
        assertThat(NutritionRounding.kcal(null)).isNull();
    }

    @Test
    void roundsGramsToOneDecimalPlace() {
        assertThat(NutritionRounding.grams(4.19999980927)).isEqualTo(4.2);
        assertThat(NutritionRounding.grams(12.04)).isEqualTo(12.0);
        assertThat(NutritionRounding.grams(0.05)).isEqualTo(0.1);
        assertThat(NutritionRounding.grams(null)).isNull();
    }
}
