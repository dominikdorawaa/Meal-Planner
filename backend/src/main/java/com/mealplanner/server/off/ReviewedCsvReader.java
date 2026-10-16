package com.mealplanner.server.off;

import java.io.BufferedReader;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.function.Consumer;

public final class ReviewedCsvReader {

    static final char SEPARATOR = ';';
    static final String DEFAULT_UNIT = "100g";
    static final List<String> REQUIRED_COLUMNS = List.of("code", "name", "kcal", "protein", "fat", "carbs", "import");

    private ReviewedCsvReader() {
    }

    public static void read(Path csv, Consumer<ReviewedRow> consumer) throws IOException {
        try (BufferedReader reader = Files.newBufferedReader(csv, StandardCharsets.UTF_8)) {
            List<String> header = nextRecord(reader);
            Map<String, Integer> columns = columns(header == null ? List.of() : header);
            int rowNumber = 1;
            List<String> record;
            while ((record = nextRecord(reader)) != null) {
                rowNumber++;
                if (record.size() == 1 && record.getFirst().isBlank()) {
                    continue;
                }
                consumer.accept(toRow(rowNumber, record, columns));
            }
        }
    }

    private static Map<String, Integer> columns(List<String> header) {
        Map<String, Integer> columns = new HashMap<>();
        for (int i = 0; i < header.size(); i++) {
            columns.put(header.get(i).replace("﻿", "").trim().toLowerCase(Locale.ROOT), i);
        }
        List<String> missing = REQUIRED_COLUMNS.stream().filter(column -> !columns.containsKey(column)).toList();
        if (!missing.isEmpty()) {
            throw new IllegalArgumentException("Missing CSV columns: " + String.join(", ", missing));
        }
        return columns;
    }

    private static ReviewedRow toRow(int rowNumber, List<String> record, Map<String, Integer> columns) {
        String unit = value(record, columns, "unit");
        return new ReviewedRow(rowNumber,
                text(record, columns, "code"),
                text(record, columns, "name"),
                text(record, columns, "brand"),
                number(value(record, columns, "kcal")),
                number(value(record, columns, "protein")),
                number(value(record, columns, "fat")),
                number(value(record, columns, "carbs")),
                unit.isEmpty() ? DEFAULT_UNIT : unit,
                "yes".equalsIgnoreCase(value(record, columns, "import")));
    }

    private static String text(List<String> record, Map<String, Integer> columns, String column) {
        return OffCandidatesExport.readCell(value(record, columns, column));
    }

    private static String value(List<String> record, Map<String, Integer> columns, String column) {
        Integer index = columns.get(column);
        return index == null || index >= record.size() ? "" : record.get(index).trim();
    }

    private static Double number(String value) {
        if (value.isEmpty()) {
            return null;
        }
        try {
            return Double.parseDouble(value.replace(',', '.'));
        } catch (NumberFormatException exception) {
            return null;
        }
    }

    private static List<String> nextRecord(BufferedReader reader) throws IOException {
        int next = reader.read();
        if (next == -1) {
            return null;
        }
        List<String> fields = new ArrayList<>();
        StringBuilder field = new StringBuilder();
        boolean quoted = false;
        while (next != -1) {
            char c = (char) next;
            if (quoted) {
                if (c == '"') {
                    reader.mark(1);
                    int following = reader.read();
                    if (following == '"') {
                        field.append('"');
                    } else {
                        quoted = false;
                        if (following != -1) {
                            reader.reset();
                        }
                    }
                } else {
                    field.append(c);
                }
            } else if (c == '"' && field.isEmpty()) {
                quoted = true;
            } else if (c == SEPARATOR) {
                fields.add(field.toString());
                field.setLength(0);
            } else if (c == '\n') {
                break;
            } else if (c != '\r') {
                field.append(c);
            }
            next = reader.read();
        }
        fields.add(field.toString());
        return fields;
    }
}
