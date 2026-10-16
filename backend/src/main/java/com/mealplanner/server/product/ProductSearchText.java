package com.mealplanner.server.product;

import java.text.Normalizer;
import java.util.Locale;
import java.util.regex.Pattern;

public final class ProductSearchText {

    private static final Pattern COMBINING_MARKS = Pattern.compile("\\p{M}+");
    private static final Pattern NON_SEARCHABLE = Pattern.compile("[^a-z0-9]+");

    private ProductSearchText() {
    }

    public static String of(String name, String brand) {
        return normalize(brand == null ? name : name + " " + brand);
    }

    public static String normalize(String text) {
        if (text == null) {
            return "";
        }
        String lowerCase = text.toLowerCase(Locale.ROOT).replace('ł', 'l');
        String withoutMarks = COMBINING_MARKS.matcher(Normalizer.normalize(lowerCase, Normalizer.Form.NFD)).replaceAll("");
        return NON_SEARCHABLE.matcher(withoutMarks).replaceAll(" ").trim();
    }
}
