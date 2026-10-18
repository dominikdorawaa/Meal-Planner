package com.mealplanner.server.off;

import com.mealplanner.server.product.ExtraNutrients;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import static org.assertj.core.api.Assertions.assertThat;

class OffImportRulesTest {

    private static OffProduct product(String code, String name, boolean polishName, Double kcal, Double protein,
                                      Double fat, Double carbs) {
        return new OffProduct(code, name, "", kcal, protein, fat, carbs, ExtraNutrients.NONE, "", polishName);
    }

    private static OffProduct skyr(String name) {
        return product("5900820000318", name, true, 65.0, 12.0, 0.0, 4.2);
    }

    @Test
    void acceptsAPolishProductWithSaneNutrition() {
        OffImportRules.Decision decision = new OffImportRules().check(skyr("Skyr naturalny"));

        assertThat(decision.accepted()).isTrue();
        assertThat(decision.errors()).isEmpty();
        assertThat(decision.warnings()).isEmpty();
    }

    @Test
    void rejectsNamesThatAreNotPolish() {
        OffImportRules.Decision decision = new OffImportRules()
                .check(product("5900820000318", "Natural skyr", false, 65.0, 12.0, 0.0, 4.2));

        assertThat(decision.errors()).containsExactly(OffImportRules.NAME_NOT_POLISH);
    }

    @Test
    void rejectsImpossibleNutritionValues() {
        OffImportRules rules = new OffImportRules();

        assertThat(rules.check(product("5900820000318", "Olej", true, 950.0, 0.0, 100.0, 0.0)).errors())
                .contains("KCAL_ABOVE_900");
        assertThat(rules.check(product("5900820000318", "Cukier", true, 400.0, 0.0, 0.0, 120.0)).errors())
                .contains("MACRO_ABOVE_100G");
        assertThat(rules.check(product("5900820000318", "Skyr", true, 65.0, null, 0.0, 4.2)).errors())
                .containsExactly("NUTRIENT_MISSING");
    }

    @Test
    void rejectsMissingAndInvalidBarCodes() {
        OffImportRules rules = new OffImportRules();

        assertThat(rules.check(product("", "Skyr", true, 65.0, 12.0, 0.0, 4.2)).errors())
                .containsExactly("INVALID_BAR_CODE");
        assertThat(rules.check(product("123", "Skyr", true, 65.0, 12.0, 0.0, 4.2)).errors())
                .containsExactly("INVALID_BAR_CODE");
    }

    @Test
    void rejectsMissingNamesOnlyOnce() {
        OffImportRules.Decision decision = new OffImportRules().check(skyr(""));

        assertThat(decision.errors()).containsExactly("NAME_MISSING");
    }

    @Test
    void acceptsEachBarCodeOnlyOnceAndIgnoresCodesOfRejectedProducts() {
        OffImportRules rules = new OffImportRules();

        assertThat(rules.check(skyr("?")).accepted()).isFalse();
        assertThat(rules.check(skyr("Skyr naturalny")).accepted()).isTrue();
        assertThat(rules.check(skyr("Skyr drugi")).errors()).containsExactly(OffImportRules.DUPLICATE_BAR_CODE);
    }

    @Test
    void keepsWarningsWithoutRejecting() {
        OffImportRules.Decision decision = new OffImportRules()
                .check(product("5900820000318", "Skyr", true, 85.0, 12.0, 0.0, 4.2));

        assertThat(decision.accepted()).isTrue();
        assertThat(decision.warnings()).containsExactly("KCAL_DEVIATION");
    }

    @ParameterizedTest
    @ValueSource(strings = {"???", "12345", "A1", "Test", "  PRODUKT ", "brak nazwy", "Unknown!", "xxx"})
    void recognisesJunkNames(String name) {
        assertThat(OffImportRules.isJunkName(name)).isTrue();
        assertThat(new OffImportRules().check(skyr(name)).errors()).containsExactly(OffImportRules.NAME_JUNK);
    }

    @ParameterizedTest
    @ValueSource(strings = {"Ser", "Mleko 2%", "Jogurt naturalny", "Chleb żytni", "Test of taste"})
    void keepsRealNames(String name) {
        assertThat(OffImportRules.isJunkName(name)).isFalse();
    }

    @ParameterizedTest
    @ValueSource(strings = {"Chicken Fingers", "Orange juice", "Coconut Milk", "Cheese And Cranberry Flavoured Chips",
            "Grill Käse", "Pierogi Mit Sauerkraut", "Cookies with jelly cube & milk cream",
            "Арахіс смажений солоний", "Magija Сырок Waniliowy", "Lacta παγωτό", "מלפפונים שלמים", "脾气条"})
    void recognisesForeignNames(String name) {
        assertThat(OffImportRules.isForeignName(name)).isTrue();
        assertThat(new OffImportRules().check(skyr(name)).errors()).containsExactly(OffImportRules.NAME_FOREIGN);
    }

    @ParameterizedTest
    @ValueSource(strings = {"Lech free limonka mięta", "ŁACIATE UHT MILK 2.0%", "Protein Drink O Smaku Waniliowym",
            "Lody Czekoladowe Z Sosem Czekoladowym", "Lech free yuzu i pomelo", "Milky Way", "Cheetos", "Jogurt naturalny"})
    void keepsPolishNamesWithSingleForeignWords(String name) {
        assertThat(OffImportRules.isForeignName(name)).isFalse();
    }
}
