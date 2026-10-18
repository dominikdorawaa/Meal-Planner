package com.mealplanner.server.off;

import com.mealplanner.server.product.NutritionCheck;
import com.mealplanner.server.product.NutritionIssue;
import com.mealplanner.server.product.NutritionValidator;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

public final class OffImportRules {

    static final String UNIT = "100g";
    static final String NAME_NOT_POLISH = "NAME_NOT_POLISH";
    static final String NAME_JUNK = "NAME_JUNK";
    static final String DUPLICATE_BAR_CODE = "DUPLICATE_BAR_CODE";
    static final int MIN_NAME_LETTERS = 3;
    static final Set<String> JUNK_NAMES = Set.of("test", "testowy", "produkt", "product", "unknown", "nieznany",
            "brak", "brak nazwy", "bez nazwy", "null", "none", "xxx");

    private final Set<String> acceptedCodes = new HashSet<>();

    public Decision check(OffProduct product) {
        NutritionCheck nutrition = NutritionValidator.check(product.name(), product.kcal(), product.protein(),
                product.fat(), product.carbs(), UNIT, product.code());
        List<String> errors = new ArrayList<>();
        if (product.code().isEmpty()) {
            errors.add(NutritionIssue.INVALID_BAR_CODE.name());
        }
        nutrition.errors().forEach(issue -> errors.add(issue.name()));
        if (!product.name().isEmpty() && !product.polishName()) {
            errors.add(NAME_NOT_POLISH);
        } else if (!product.name().isEmpty() && isJunkName(product.name())) {
            errors.add(NAME_JUNK);
        }
        if (errors.isEmpty() && !acceptedCodes.add(product.code())) {
            errors.add(DUPLICATE_BAR_CODE);
        }
        return new Decision(errors, nutrition.warnings().stream().map(NutritionIssue::name).toList());
    }

    static boolean isJunkName(String name) {
        long letters = name.codePoints().filter(Character::isLetter).count();
        String normalized = name.toLowerCase(Locale.ROOT).replaceAll("[^\\p{L}\\p{N} ]", " ").trim()
                .replaceAll(" +", " ");
        return letters < MIN_NAME_LETTERS || JUNK_NAMES.contains(normalized);
    }

    public record Decision(List<String> errors, List<String> warnings) {

        public boolean accepted() {
            return errors.isEmpty();
        }
    }
}
