package com.mealplanner.server.product;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

public final class ProductMeasures {

    public static final String PACKAGE = "package";
    static final String PIECE = "piece";
    static final String GRAMS = "g";
    static final String MILLILITERS = "ml";
    static final double MAX_BASE_AMOUNT = 5000;
    static final double MAX_PIECES = 100;

    private static volatile List<MeasureKind> genericKinds = List.of();

    private ProductMeasures() {
    }

    static void useGenericKinds(List<MeasureKind> kinds) {
        genericKinds = List.copyOf(kinds);
    }

    static boolean perPiece(String unit) {
        return NutritionValidator.PER_PIECE_UNIT.equals(unit);
    }

    public static String baseCode(String unit) {
        if (perPiece(unit)) {
            return PIECE;
        }
        return PackageWeight.VOLUME_UNIT.equals(unit) ? MILLILITERS : GRAMS;
    }

    static String resolveCode(String unit, String code) {
        boolean baseAlias = !perPiece(unit) && (GRAMS.equals(code) || MILLILITERS.equals(code));
        return baseAlias ? baseCode(unit) : code;
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

    static List<Measure> generic(String unit, List<ProductMeasure> stored) {
        if (perPiece(unit)) {
            return List.of();
        }
        Set<String> storedCodes = stored.stream().map(measure -> measure.getKind().getCode()).collect(Collectors.toSet());
        return genericKinds.stream()
                .filter(kind -> !storedCodes.contains(kind.getCode()))
                .map(kind -> new Measure(kind.getCode(), kind.getGenericBaseAmount(), false, kind.getNames(),
                        kind.getMaxAmount()))
                .toList();
    }
}
