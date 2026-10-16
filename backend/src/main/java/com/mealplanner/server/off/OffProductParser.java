package com.mealplanner.server.off;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.util.Locale;
import java.util.Optional;

public final class OffProductParser {

    static final String POLAND_TAG = "en:poland";
    static final String POLISH = "pl";
    static final double KJ_PER_KCAL = 4.184;

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
        JsonNode nutriments = node.path("nutriments");
        PolishName name = polishName(node);
        return new OffProduct(
                text(node, "code"),
                name.text(),
                firstBrand(text(node, "brands")),
                kcal(nutriments),
                number(nutriments.path("proteins_100g")),
                number(nutriments.path("fat_100g")),
                number(nutriments.path("carbohydrates_100g")),
                text(node, "quantity"),
                name.polish());
    }

    private record PolishName(String text, boolean polish) {
    }

    private static PolishName polishName(JsonNode node) {
        String polishName = text(node, "product_name_pl");
        String genericName = text(node, "generic_name_pl");
        String mainName = text(node, "product_name");
        if (polishName.isEmpty() && POLISH.equals(text(node, "lang"))) {
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

    private static boolean isSoldInPoland(JsonNode node) {
        for (JsonNode tag : node.path("countries_tags")) {
            if (POLAND_TAG.equals(tag.asString())) {
                return true;
            }
        }
        return false;
    }

    private static Double kcal(JsonNode nutriments) {
        Double kcal = number(nutriments.path("energy-kcal_100g"));
        if (kcal != null) {
            return kcal;
        }
        Double kj = number(nutriments.path("energy-kj_100g"));
        return kj == null ? null : Math.round(kj / KJ_PER_KCAL * 10) / 10.0;
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
