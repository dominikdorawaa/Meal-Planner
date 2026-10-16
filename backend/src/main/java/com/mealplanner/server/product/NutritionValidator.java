package com.mealplanner.server.product;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Stream;

public final class NutritionValidator {

    static final double MAX_KCAL_PER_100G = 900;
    static final double MAX_GRAMS_PER_100G = 100;
    static final double MACROS_SUM_ROUNDING = 1;
    static final double KJ_RATIO_MIN = 3.8;
    static final double KJ_RATIO_MAX = 4.6;
    static final double KJ_MIN_EXPECTED_KCAL = 20;
    static final double MISMATCH_MIN_KCAL = 40;
    static final double MISMATCH_RATIO = 0.35;
    static final double DEVIATION_MIN_KCAL = 15;
    static final double DEVIATION_RATIO = 0.15;
    static final String PER_PIECE_UNIT = "pc";

    private NutritionValidator() {
    }

    public static NutritionCheck check(Product product) {
        return check(product.getName(), product.getKcal(), product.getProtein(), product.getFat(),
                product.getCarbs(), product.getUnit(), product.getBarCode());
    }

    public static NutritionCheck check(String name, Double kcal, Double protein, Double fat, Double carbs,
                                       String unit, String barCode) {
        List<NutritionIssue> issues = new ArrayList<>();
        if (name == null || name.isBlank()) {
            issues.add(NutritionIssue.NAME_MISSING);
        }
        if (barCode != null && !barCode.isBlank() && !BarCodes.isValid(barCode.trim())) {
            issues.add(NutritionIssue.INVALID_BAR_CODE);
        }
        if (Stream.of(kcal, protein, fat, carbs).anyMatch(value -> value == null)) {
            issues.add(NutritionIssue.NUTRIENT_MISSING);
            return split(issues);
        }
        if (Stream.of(kcal, protein, fat, carbs).anyMatch(value -> value < 0)) {
            issues.add(NutritionIssue.NEGATIVE_VALUE);
        }
        if (!PER_PIECE_UNIT.equals(unit)) {
            checkPerHundredGrams(issues, kcal, protein, fat, carbs);
        }
        checkEnergy(issues, kcal, protein, fat, carbs);
        return split(issues);
    }

    private static void checkPerHundredGrams(List<NutritionIssue> issues, double kcal, double protein,
                                             double fat, double carbs) {
        if (kcal > MAX_KCAL_PER_100G) {
            issues.add(NutritionIssue.KCAL_ABOVE_900);
        }
        if (Stream.of(protein, fat, carbs).anyMatch(value -> value > MAX_GRAMS_PER_100G)) {
            issues.add(NutritionIssue.MACRO_ABOVE_100G);
        }
        if (protein + fat + carbs > MAX_GRAMS_PER_100G + MACROS_SUM_ROUNDING) {
            issues.add(NutritionIssue.MACROS_SUM_ABOVE_100G);
        }
    }

    private static void checkEnergy(List<NutritionIssue> issues, double kcal, double protein, double fat,
                                    double carbs) {
        double expected = 4 * protein + 4 * carbs + 9 * fat;
        if (expected > KJ_MIN_EXPECTED_KCAL) {
            double ratio = kcal / expected;
            if (ratio >= KJ_RATIO_MIN && ratio <= KJ_RATIO_MAX) {
                issues.add(NutritionIssue.KCAL_LOOKS_LIKE_KJ);
                return;
            }
        }
        double difference = Math.abs(kcal - expected);
        double scale = Math.max(kcal, expected);
        if (difference > Math.max(MISMATCH_MIN_KCAL, MISMATCH_RATIO * scale)) {
            issues.add(NutritionIssue.KCAL_MISMATCH);
        } else if (difference > Math.max(DEVIATION_MIN_KCAL, DEVIATION_RATIO * scale)) {
            issues.add(NutritionIssue.KCAL_DEVIATION);
        }
    }

    private static NutritionCheck split(List<NutritionIssue> issues) {
        return new NutritionCheck(
                issues.stream().filter(NutritionIssue::isError).toList(),
                issues.stream().filter(issue -> !issue.isError()).toList());
    }
}
