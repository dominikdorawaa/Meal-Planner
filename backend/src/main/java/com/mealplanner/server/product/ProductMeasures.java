package com.mealplanner.server.product;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

public final class ProductMeasures {

    public static final String PACKAGE = "package";
    static final String PIECE = "piece";
    static final String GRAMS = "g";
    static final String MILLILITERS = "ml";
    static final double MAX_BASE_AMOUNT = 5000;
    static final double MAX_PIECES = 100;

    private ProductMeasures() {
    }

    static boolean perPiece(String unit) {
        return NutritionValidator.PER_PIECE_UNIT.equals(unit);
    }

    static String baseCode(String unit) {
        if (perPiece(unit)) {
            return PIECE;
        }
        return PackageWeight.VOLUME_UNIT.equals(unit) ? MILLILITERS : GRAMS;
    }

    static List<Measure> describe(String unit, List<ProductMeasure> stored) {
        if (perPiece(unit)) {
            return List.of(new Measure(PIECE, 1.0, true, null, MAX_PIECES));
        }
        List<Measure> extra = stored.stream()
                .sorted(Comparator.comparing(ProductMeasure::isDefaultMeasure).reversed()
                        .thenComparing(ProductMeasure::getPosition))
                .map(Measure::of)
                .toList();
        boolean baseIsDefault = extra.stream().noneMatch(measure -> measure.defaultMeasure());
        Measure base = new Measure(baseCode(unit), 1.0, baseIsDefault, null, MAX_BASE_AMOUNT);
        List<Measure> measures = new ArrayList<>();
        if (baseIsDefault) {
            measures.add(base);
        }
        measures.addAll(extra);
        if (!baseIsDefault) {
            measures.add(base);
        }
        return measures;
    }
}
