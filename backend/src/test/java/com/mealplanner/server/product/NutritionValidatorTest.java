package com.mealplanner.server.product;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;

import static com.mealplanner.server.product.NutritionIssue.*;
import static org.assertj.core.api.Assertions.assertThat;

class NutritionValidatorTest {

    private static NutritionCheck check(Double kcal, Double protein, Double fat, Double carbs) {
        return NutritionValidator.check("Product", kcal, protein, fat, carbs, "100g", null);
    }

    @ParameterizedTest
    @CsvSource({
            "65, 12, 0, 4.2",
            "900, 0, 100, 0",
            "0, 0, 0, 0",
            "546, 4.9, 31, 61",
            "110, 23, 1.2, 0"
    })
    void acceptsRealisticProducts(double kcal, double protein, double fat, double carbs) {
        NutritionCheck result = check(kcal, protein, fat, carbs);

        assertThat(result.errors()).isEmpty();
        assertThat(result.warnings()).isEmpty();
        assertThat(result.isValid()).isTrue();
    }

    @Test
    void rejectsMissingName() {
        assertThat(NutritionValidator.check(" ", 65.0, 12.0, 0.0, 4.2, null, null).errors())
                .containsExactly(NAME_MISSING);
        assertThat(NutritionValidator.check(null, 65.0, 12.0, 0.0, 4.2, null, null).errors())
                .containsExactly(NAME_MISSING);
    }

    @Test
    void rejectsMissingNutrients() {
        assertThat(check(null, 12.0, 0.0, 4.2).errors()).containsExactly(NUTRIENT_MISSING);
        assertThat(check(65.0, 12.0, null, 4.2).errors()).containsExactly(NUTRIENT_MISSING);
    }

    @Test
    void rejectsNegativeValues() {
        assertThat(check(65.0, -1.0, 0.0, 8.0).errors()).contains(NEGATIVE_VALUE);
    }

    @Test
    void rejectsEnergyAbove900Kcal() {
        assertThat(check(950.0, 0.0, 105.0, 0.0).errors()).contains(KCAL_ABOVE_900, MACRO_ABOVE_100G);
    }

    @Test
    void rejectsMacrosAbove100Grams() {
        assertThat(check(400.0, 50.0, 0.0, 60.0).errors()).containsExactly(MACROS_SUM_ABOVE_100G);
        assertThat(check(404.0, 101.0, 0.0, 0.0).errors()).contains(MACRO_ABOVE_100G);
    }

    @Test
    void allowsSmallRoundingOverOneHundredGrams() {
        assertThat(check(888.0, 0.5, 100.0, 0.5).errors()).isEmpty();
    }

    @Test
    void detectsEnergyGivenInKilojoules() {
        assertThat(check(1530.0, 12.0, 20.0, 40.0).errors()).containsExactly(KCAL_ABOVE_900, KCAL_LOOKS_LIKE_KJ);
        assertThat(check(272.0, 12.0, 0.0, 4.2).errors()).containsExactly(KCAL_LOOKS_LIKE_KJ);
    }

    @ParameterizedTest
    @CsvSource({
            "250, 0, 0, 0",
            "100, 12, 20, 40",
            "380, 10, 2, 5"
    })
    void rejectsEnergyThatDoesNotMatchMacros(double kcal, double protein, double fat, double carbs) {
        assertThat(check(kcal, protein, fat, carbs).errors()).containsExactly(KCAL_MISMATCH);
    }

    @Test
    void warnsAboutModerateEnergyDeviation() {
        NutritionCheck result = check(450.0, 10.0, 10.0, 60.0);

        assertThat(result.errors()).isEmpty();
        assertThat(result.warnings()).containsExactly(KCAL_DEVIATION);
        assertThat(result.isValid()).isTrue();
    }

    @Test
    void skipsPerHundredGramLimitsForProductsCountedPerPiece() {
        NutritionCheck result = NutritionValidator.check("Pizza", 1800.0, 80.0, 70.0, 210.0, "pc", null);

        assertThat(result.errors()).isEmpty();
    }

    @ParameterizedTest
    @ValueSource(strings = {"5900820000318", "5901234123457", "96385074", "036000291452"})
    void acceptsValidBarCodes(String barCode) {
        assertThat(BarCodes.isValid(barCode)).isTrue();
        assertThat(NutritionValidator.check("Product", 65.0, 12.0, 0.0, 4.2, "100g", barCode).errors()).isEmpty();
    }

    @ParameterizedTest
    @ValueSource(strings = {"5900820000319", "123", "59008200003a8", "12345678901234567"})
    void rejectsInvalidBarCodes(String barCode) {
        assertThat(BarCodes.isValid(barCode)).isFalse();
        assertThat(NutritionValidator.check("Product", 65.0, 12.0, 0.0, 4.2, "100g", barCode).errors())
                .containsExactly(INVALID_BAR_CODE);
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {"  "})
    void treatsMissingBarCodeAsValid(String barCode) {
        assertThat(NutritionValidator.check("Product", 65.0, 12.0, 0.0, 4.2, "100g", barCode).errors()).isEmpty();
    }

    @Test
    void checksProductEntity() {
        Product product = new Product();
        product.setName("Skyr");
        product.setKcal(65.0);
        product.setProtein(12.0);
        product.setFat(0.0);
        product.setCarbs(4.2);
        product.setBarCode("5900820000318");

        assertThat(NutritionValidator.check(product).isValid()).isTrue();
    }

    @Test
    void namesMessageKeysAfterIssueCodes() {
        assertThat(KCAL_LOOKS_LIKE_KJ.messageKey()).isEqualTo("product.nutrition.kcal-looks-like-kj");
        assertThat(KCAL_DEVIATION.isError()).isFalse();
        assertThat(KCAL_MISMATCH.isError()).isTrue();
    }
}
