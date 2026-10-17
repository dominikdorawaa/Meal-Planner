package com.mealplanner.server.off;

import com.mealplanner.server.product.ExtraNutrients;
import com.mealplanner.server.product.NutritionCheck;
import com.mealplanner.server.product.NutritionIssue;
import com.mealplanner.server.product.NutritionRounding;
import com.mealplanner.server.product.NutritionValidator;
import tools.jackson.core.JacksonException;

import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.Writer;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.TreeMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.zip.GZIPInputStream;

public final class OffCandidatesExport {

    static final String SEPARATOR = ";";
    static final String UNIT = "100g";
    static final String DUPLICATE_BAR_CODE = "DUPLICATE_BAR_CODE";
    static final String NAME_NOT_POLISH = "NAME_NOT_POLISH";
    static final String PRODUCT_URL = "https://world.openfoodfacts.org/product/";
    static final List<String> HEADER = List.of("code", "name", "brand", "kcal", "protein", "fat", "carbs",
            "saturated_fat", "sugars", "fiber", "salt", "unit", "quantity", "validation", "reasons", "import", "url");
    static final String FORMULA_PREFIXES = "=+-@\t\r";
    static final char TEXT_MARKER = '\'';

    private static final Pattern DIGITS = Pattern.compile("[0-9]+");
    private static final Pattern BAR_CODE_CELL = Pattern.compile("=\"([0-9]+)\"");

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
        Set<String> seenCodes = new HashSet<>();

        try (BufferedReader reader = open(dump);
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
                NutritionCheck check = NutritionValidator.check(product.name(), product.kcal(), product.protein(),
                        product.fat(), product.carbs(), UNIT, product.code());
                List<String> errors = new ArrayList<>(check.errors().stream().map(NutritionIssue::name).toList());
                if (!product.polishName() && !product.name().isEmpty()) {
                    errors.add(NAME_NOT_POLISH);
                }
                if (errors.isEmpty() && !seenCodes.add(product.code())) {
                    errors.add(DUPLICATE_BAR_CODE);
                }
                if (errors.isEmpty()) {
                    accepted++;
                } else {
                    errors.forEach(reason -> rejectedByReason.merge(reason, 1L, Long::sum));
                }
                writeRow(writer, row(product, check, errors));
            }
        }
        return new ExportSummary(polishProducts, accepted, polishProducts - accepted, skippedLines, rejectedByReason);
    }

    private static List<String> row(OffProduct product, NutritionCheck check, List<String> errors) {
        List<String> reasons = new ArrayList<>(errors);
        check.warnings().forEach(warning -> reasons.add(warning.name()));
        boolean ok = errors.isEmpty();
        ExtraNutrients extras = product.extras().cleanedFor(product.fat(), product.carbs());
        return List.of(barCodeCell(product.code()), textCell(product.name()), textCell(product.brand()),
                decimal(NutritionRounding.kcal(product.kcal())), decimal(NutritionRounding.grams(product.protein())),
                decimal(NutritionRounding.grams(product.fat())), decimal(NutritionRounding.grams(product.carbs())),
                decimal(extras.saturatedFat()), decimal(extras.sugars()),
                decimal(extras.fiber()), decimal(extras.salt()), UNIT, textCell(product.quantity()),
                ok ? "OK" : "REJECTED", String.join(",", reasons), ok ? "yes" : "no", PRODUCT_URL + product.code());
    }

    public static String readCell(String cell) {
        Matcher barCode = BAR_CODE_CELL.matcher(cell);
        if (barCode.matches()) {
            return barCode.group(1);
        }
        if (cell.length() > 1 && cell.charAt(0) == TEXT_MARKER && needsTextMarker(cell.substring(1))) {
            return cell.substring(1);
        }
        return cell;
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

    private static BufferedReader open(Path dump) throws IOException {
        InputStream input = Files.newInputStream(dump);
        if (dump.getFileName().toString().endsWith(".gz")) {
            input = new GZIPInputStream(input, 1 << 16);
        }
        return new BufferedReader(new InputStreamReader(input, StandardCharsets.UTF_8), 1 << 16);
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
