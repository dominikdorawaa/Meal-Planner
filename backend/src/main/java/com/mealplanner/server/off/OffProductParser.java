package com.mealplanner.server.off;

import com.mealplanner.server.product.ExtraNutrients;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;

public final class OffProductParser {

    static final String POLAND_TAG = "en:poland";
    static final String POLISH = "pl";
    static final String POLISH_BARCODE_PREFIX = "590";
    static final double KJ_PER_KCAL = 4.184;
    static final Set<String> PER_HUNDRED = Set.of("100g", "100ml");
    static final String AS_SOLD = "as_sold";

    private static final JsonMapper MAPPER = JsonMapper.builder().build();

    private OffProductParser() {
    }

    public static boolean mightBePolish(String line) {
        return line.contains(POLAND_TAG);
    }

    public static Optional<OffProduct> parse(String line) {
        JsonNode node = MAPPER.readTree(line);
        if (!isSoldInPoland(node)) {
            return Optional.empty();
        }
        return Optional.of(fromNode(node));
    }

    public static OffProduct fromNode(JsonNode node) {
        PolishName name = polishName(node);
        Double fat = nutrient(node, "fat");
        return new OffProduct(
                text(node, "code"),
                OffNameRules.withFatPercent(OffNameRules.normalize(name.text()), fat, categories(node)),
                firstBrand(text(node, "brands")),
                kcal(node),
                nutrient(node, "proteins"),
                fat,
                nutrient(node, "carbohydrates"),
                new ExtraNutrients(
                        nutrient(node, "saturated-fat"),
                        nutrient(node, "sugars"),
                        nutrient(node, "fiber"),
                        nutrient(node, "salt")),
                text(node, "quantity"),
                name.polish());
    }

    private record PolishName(String text, boolean polish) {
    }

    private static PolishName polishName(JsonNode node) {
        String polishName = text(node, "product_name_pl");
        String genericName = text(node, "generic_name_pl");
        String mainName = text(node, "product_name");
        if (polishName.isEmpty() && (POLISH.equals(text(node, "lang")) || isPolishBarcode(text(node, "code")))) {
            polishName = mainName;
        }
        if (!polishName.isEmpty()) {
            return new PolishName(completeName(polishName, genericName), true);
        }
        if (!genericName.isEmpty()) {
            return new PolishName(genericName, true);
        }
        return new PolishName(readableForeignName(node, mainName), false);
    }

    private static boolean isPolishBarcode(String code) {
        return code.length() == 13 && code.startsWith(POLISH_BARCODE_PREFIX);
    }

    private static String readableForeignName(JsonNode node, String mainName) {
        String englishName = text(node, "product_name_en");
        if (!englishName.isEmpty()) {
            return englishName;
        }
        return isLatinScript(mainName) ? mainName : "";
    }

    private static boolean isLatinScript(String name) {
        return name.codePoints()
                .filter(Character::isLetter)
                .allMatch(codePoint -> Character.UnicodeScript.of(codePoint) == Character.UnicodeScript.LATIN);
    }

    private static String completeName(String name, String genericName) {
        boolean genericAddsDetails = genericName.length() > name.length()
                && genericName.toLowerCase(Locale.ROOT).startsWith(name.toLowerCase(Locale.ROOT));
        return genericAddsDetails ? genericName : name;
    }

    private static List<String> categories(JsonNode node) {
        List<String> categories = new ArrayList<>();
        for (JsonNode tag : node.path("categories_tags")) {
            if (tag.isString()) {
                categories.add(tag.asString());
            }
        }
        return categories;
    }

    private static boolean isSoldInPoland(JsonNode node) {
        for (JsonNode tag : node.path("countries_tags")) {
            if (POLAND_TAG.equals(tag.asString())) {
                return true;
            }
        }
        return false;
    }

    private static Double kcal(JsonNode node) {
        Double kcal = nutrient(node, "energy-kcal");
        if (kcal != null) {
            return kcal;
        }
        Double kj = nutrient(node, "energy-kj");
        return kj == null ? null : Math.round(kj / KJ_PER_KCAL * 10) / 10.0;
    }

    private static Double nutrient(JsonNode node, String name) {
        Double value = number(node.path("nutriments").path(name + "_100g"));
        if (value != null) {
            return value;
        }
        JsonNode aggregated = node.path("nutrition").path("aggregated_set");
        if (!PER_HUNDRED.contains(text(aggregated, "per")) || !AS_SOLD.equals(text(aggregated, "preparation"))) {
            return null;
        }
        return number(aggregated.path("nutrients").path(name).path("value"));
    }

    private static Double number(JsonNode value) {
        Double parsed = parsedNumber(value);
        return parsed == null || !Double.isFinite(parsed) ? null : parsed;
    }

    private static Double parsedNumber(JsonNode value) {
        if (value.isNumber()) {
            return value.doubleValue();
        }
        if (value.isString()) {
            try {
                return Double.parseDouble(value.asString().trim().replace(',', '.'));
            } catch (NumberFormatException exception) {
                return null;
            }
        }
        return null;
    }

    private static String text(JsonNode node, String field) {
        JsonNode value = node.path(field);
        return value.isString() ? value.asString().trim() : "";
    }

    private static String firstBrand(String brands) {
        int comma = brands.indexOf(',');
        return (comma < 0 ? brands : brands.substring(0, comma)).trim();
    }
}
