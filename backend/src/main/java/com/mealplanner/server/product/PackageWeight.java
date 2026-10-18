package com.mealplanner.server.product;

import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class PackageWeight {

    static final double MAX_WEIGHT = 50_000;
    static final String MASS_UNIT = "100g";
    static final String VOLUME_UNIT = "100ml";

    private static final Pattern QUANTITY =
            Pattern.compile("^(?:(\\d+)\\s*[x×*]\\s*)?(\\d+(?:\\.\\d+)?)\\s*(kg|g|ml|cl|l)$");
    private static final Pattern DETAILS_IN_BRACKETS = Pattern.compile("\\s*\\(.*\\)$");
    private static final Pattern ESTIMATED_SIGN = Pattern.compile("\\s*(℮|\\be)$");
    private static final Map<String, Double> MASS_FACTORS = Map.of("g", 1.0, "kg", 1000.0);
    private static final Map<String, Double> VOLUME_FACTORS = Map.of("ml", 1.0, "cl", 10.0, "l", 1000.0);

    private PackageWeight() {
    }

    public static Double parse(String quantity, String productUnit) {
        Map<String, Double> factors = factorsFor(productUnit);
        if (quantity == null || factors == null) {
            return null;
        }
        Matcher matcher = QUANTITY.matcher(normalized(quantity));
        if (!matcher.matches() || !factors.containsKey(matcher.group(3))) {
            return null;
        }
        int packs = matcher.group(1) == null ? 1 : Integer.parseInt(matcher.group(1));
        double weight = packs * Double.parseDouble(matcher.group(2)) * factors.get(matcher.group(3));
        double rounded = Math.round(weight * 10) / 10.0;
        return rounded > 0 && isValid(rounded) ? rounded : null;
    }

    public static boolean isValid(Double weight) {
        return weight == null || (Double.isFinite(weight) && weight > 0 && weight <= MAX_WEIGHT);
    }

    private static Map<String, Double> factorsFor(String productUnit) {
        if (MASS_UNIT.equals(productUnit)) {
            return MASS_FACTORS;
        }
        if (VOLUME_UNIT.equals(productUnit)) {
            return VOLUME_FACTORS;
        }
        return null;
    }

    private static String normalized(String quantity) {
        String text = quantity.trim().toLowerCase(Locale.ROOT).replace(',', '.');
        text = DETAILS_IN_BRACKETS.matcher(text).replaceFirst("");
        return ESTIMATED_SIGN.matcher(text).replaceFirst("").trim();
    }
}
