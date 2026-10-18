package com.mealplanner.server.off;

import com.mealplanner.server.product.ExtraNutrients;
import com.mealplanner.server.product.NutritionRounding;
import tools.jackson.core.JacksonException;

import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.IOException;
import java.io.Writer;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.TreeMap;
import java.util.regex.Pattern;

public final class OffCandidatesExport {

    static final String SEPARATOR = ";";
    static final String PRODUCT_URL = "https://world.openfoodfacts.org/product/";
    static final List<String> HEADER = List.of("code", "name", "brand", "kcal", "protein", "fat", "carbs",
            "saturated_fat", "sugars", "fiber", "salt", "unit", "quantity", "validation", "reasons", "import", "url");
    static final String FORMULA_PREFIXES = "=+-@\t\r";
    static final char TEXT_MARKER = '\'';

    private static final Pattern DIGITS = Pattern.compile("[0-9]+");

    private OffCandidatesExport() {
    }

    public static void main(String[] args) throws IOException {
        if (args.length != 2) {
            throw new IllegalArgumentException("Usage: OffCandidatesExport <dump.jsonl[.gz]> <candidates.csv>");
        }
        Path output = Path.of(args[1]);
        ExportSummary summary = export(Path.of(args[0]), output);
        String description = summary.describe();
        Files.writeString(output.resolveSibling(output.getFileName() + ".summary.txt"), description);
        System.out.print(description);
    }

    public static ExportSummary export(Path dump, Path output) throws IOException {
        long polishProducts = 0;
        long accepted = 0;
        long skippedLines = 0;
        Map<String, Long> rejectedByReason = new TreeMap<>();
        OffImportRules rules = new OffImportRules();

        try (BufferedReader reader = OffDump.open(dump);
             BufferedWriter writer = Files.newBufferedWriter(output, StandardCharsets.UTF_8)) {
            writer.write('﻿');
            writeRow(writer, HEADER);
            String line;
            while ((line = reader.readLine()) != null) {
                if (!OffProductParser.mightBePolish(line)) {
                    continue;
                }
                Optional<OffProduct> parsed;
                try {
                    parsed = OffProductParser.parse(line);
                } catch (JacksonException exception) {
                    skippedLines++;
                    continue;
                }
                if (parsed.isEmpty()) {
                    continue;
                }
                OffProduct product = parsed.get();
                polishProducts++;
                OffImportRules.Decision decision = rules.check(product);
                if (decision.accepted()) {
                    accepted++;
                } else {
                    decision.errors().forEach(reason -> rejectedByReason.merge(reason, 1L, Long::sum));
                }
                writeRow(writer, row(product, decision));
            }
        }
        return new ExportSummary(polishProducts, accepted, polishProducts - accepted, skippedLines, rejectedByReason);
    }

    private static List<String> row(OffProduct product, OffImportRules.Decision decision) {
        List<String> reasons = new ArrayList<>(decision.errors());
        reasons.addAll(decision.warnings());
        boolean ok = decision.accepted();
        ExtraNutrients extras = product.extras().cleanedFor(product.fat(), product.carbs());
        return List.of(barCodeCell(product.code()), textCell(product.name()), textCell(product.brand()),
                decimal(NutritionRounding.kcal(product.kcal())), decimal(NutritionRounding.grams(product.protein())),
                decimal(NutritionRounding.grams(product.fat())), decimal(NutritionRounding.grams(product.carbs())),
                decimal(extras.saturatedFat()), decimal(extras.sugars()),
                decimal(extras.fiber()), decimal(extras.salt()), OffImportRules.UNIT, textCell(product.quantity()),
                ok ? "OK" : "REJECTED", String.join(",", reasons), ok ? "yes" : "no", PRODUCT_URL + product.code());
    }

    private static String barCodeCell(String code) {
        return DIGITS.matcher(code).matches() ? "=\"" + code + "\"" : textCell(code);
    }

    private static String textCell(String value) {
        return needsTextMarker(value) ? TEXT_MARKER + value : value;
    }

    private static boolean needsTextMarker(String value) {
        return !value.isEmpty() && (value.charAt(0) == TEXT_MARKER || FORMULA_PREFIXES.indexOf(value.charAt(0)) >= 0);
    }

    private static String decimal(Double value) {
        return value == null ? "" : BigDecimal.valueOf(value).stripTrailingZeros().toPlainString().replace('.', ',');
    }

    private static void writeRow(Writer writer, List<String> values) throws IOException {
        for (int i = 0; i < values.size(); i++) {
            if (i > 0) {
                writer.write(SEPARATOR);
            }
            writer.write(quote(values.get(i)));
        }
        writer.write("\r\n");
    }

    private static String quote(String value) {
        if (value.contains(SEPARATOR) || value.contains("\"") || value.contains("\n") || value.contains("\r")) {
            return "\"" + value.replace("\"", "\"\"") + "\"";
        }
        return value;
    }
}
