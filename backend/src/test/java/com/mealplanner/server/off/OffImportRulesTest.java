package com.mealplanner.server.off;

import com.mealplanner.server.product.ExtraNutrients;
import org.junit.jupiter.api.Test;

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

    @Test
    void rejectsJunkNames() {
        assertThat(new OffImportRules().check(skyr("brak nazwy")).errors()).containsExactly(OffImportRules.NAME_JUNK);
    }

    @Test
    void rejectsForeignNames() {
        assertThat(new OffImportRules().check(skyr("Kysané podmáslí")).errors())
                .containsExactly(OffImportRules.NAME_FOREIGN);
    }
}
