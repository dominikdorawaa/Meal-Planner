package com.mealplanner.server.off;

import com.mealplanner.server.product.NutritionCheck;
import com.mealplanner.server.product.NutritionIssue;
import com.mealplanner.server.product.NutritionValidator;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

public final class OffImportRules {

    static final String UNIT = "100g";
    static final String NAME_NOT_POLISH = "NAME_NOT_POLISH";
    static final String NAME_JUNK = "NAME_JUNK";
    static final String NAME_FOREIGN = "NAME_FOREIGN";
    static final String DUPLICATE_BAR_CODE = "DUPLICATE_BAR_CODE";
    static final int MIN_NAME_LETTERS = 3;
    static final Set<String> JUNK_NAMES = Set.of("test", "testowy", "produkt", "product", "unknown", "nieznany",
            "brak", "brak nazwy", "bez nazwy", "null", "none", "xxx");
    static final Set<String> FOREIGN_WORDS = Set.of("with", "and", "of", "the", "flavour", "flavor", "chocolate",
            "cheese", "milk", "bread", "juice", "sauce", "chicken", "cream", "drink", "free", "natural", "organic",
            "mit", "und", "schokolade", "käse");
    static final Set<String> POLISH_WORDS = Set.of("z", "ze", "w", "we", "o", "i", "na", "do", "bez", "smaku", "dla");
    static final String POLISH_LETTERS = "ąćęłńóśźż";

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
        } else if (isForeignName(product.name())) {
            errors.add(NAME_FOREIGN);
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

    static boolean isForeignName(String name) {
        String lowerCase = name.toLowerCase(Locale.ROOT);
        Set<String> words = Set.copyOf(Arrays.asList(lowerCase.split("[^\\p{L}]+")));
        boolean hasPolishLetter = lowerCase.chars().anyMatch(letter -> POLISH_LETTERS.indexOf(letter) >= 0);
        boolean hasNonLatinLetter = lowerCase.codePoints().filter(Character::isLetter)
                .anyMatch(letter -> Character.UnicodeScript.of(letter) != Character.UnicodeScript.LATIN);
        return hasNonLatinLetter || words.stream().anyMatch(FOREIGN_WORDS::contains)
                && !hasPolishLetter
                && words.stream().noneMatch(POLISH_WORDS::contains);
    }

    public record Decision(List<String> errors, List<String> warnings) {

        public boolean accepted() {
            return errors.isEmpty();
        }
    }
}
