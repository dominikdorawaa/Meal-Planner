package com.mealplanner.server.off;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ReviewedCsvReaderTest {

    @TempDir
    Path tempDir;

    private List<ReviewedRow> read(String content) throws IOException {
        Path csv = tempDir.resolve("reviewed.csv");
        Files.writeString(csv, content, StandardCharsets.UTF_8);
        List<ReviewedRow> rows = new ArrayList<>();
        ReviewedCsvReader.read(csv, rows::add);
        return rows;
    }

    @Test
    void readsRowsWrittenByTheExport() throws IOException {
        List<ReviewedRow> rows = read("﻿code;name;brand;kcal;protein;fat;carbs;unit;quantity;validation;reasons;import;url\r\n"
                + "5900820000318;Skyr naturalny;Piątnica;65;12;0;4,2;100g;150 g;OK;;yes;https://example.com\r\n"
                + "5901234123457;\"Baton; \"\"Mocny\"\"\nwielolinijkowy\";;500;5;25;65;100g;;OK;;YES;\r\n"
                + "96385074;Napój;;180;0;0;11;100g;;REJECTED;KCAL_LOOKS_LIKE_KJ;no;\r\n");

        assertThat(rows).containsExactly(
                new ReviewedRow(2, "5900820000318", "Skyr naturalny", "Piątnica", 65.0, 12.0, 0.0, 4.2, "100g", true),
                new ReviewedRow(3, "5901234123457", "Baton; \"Mocny\"\nwielolinijkowy", "", 500.0, 5.0, 25.0, 65.0,
                        "100g", true),
                new ReviewedRow(4, "96385074", "Napój", "", 180.0, 0.0, 0.0, 11.0, "100g", false));
    }

    @Test
    void readsBarCodesAndTextBackFromAFileCreatedByTheExport() throws IOException {
        Path dump = tempDir.resolve("dump.jsonl");
        Files.write(dump, List.of(
                "{\"code\":\"036000291452\",\"product_name\":\"=Skyr\",\"brands\":\"+Brand\",\"countries_tags\":[\"en:poland\"],"
                        + "\"nutriments\":{\"energy-kcal_100g\":65,\"proteins_100g\":12,\"fat_100g\":0,\"carbohydrates_100g\":4.2}}",
                "{\"code\":\"5900820000318\",\"product_name\":\"'Ser\",\"countries_tags\":[\"en:poland\"],"
                        + "\"nutriments\":{\"energy-kcal_100g\":65,\"proteins_100g\":12,\"fat_100g\":0,\"carbohydrates_100g\":4.2}}"));
        Path csv = tempDir.resolve("exported.csv");
        OffCandidatesExport.export(dump, csv);
        List<ReviewedRow> rows = new ArrayList<>();

        ReviewedCsvReader.read(csv, rows::add);

        assertThat(rows).containsExactly(
                new ReviewedRow(2, "036000291452", "=Skyr", "+Brand", 65.0, 12.0, 0.0, 4.2, "100g", true),
                new ReviewedRow(3, "5900820000318", "'Ser", "", 65.0, 12.0, 0.0, 4.2, "100g", true));
    }

    @Test
    void acceptsColumnsInAnyOrderAndMissingOptionalOnes() throws IOException {
        List<ReviewedRow> rows = read("import;kcal;protein;fat;carbs;name;code\n yes ;65;12;;x;Skyr;5900820000318\n");

        assertThat(rows).containsExactly(
                new ReviewedRow(2, "5900820000318", "Skyr", "", 65.0, 12.0, null, null, "100g", true));
    }

    @Test
    void ignoresEmptyLines() throws IOException {
        assertThat(read("code;name;kcal;protein;fat;carbs;import\n\n")).isEmpty();
    }

    @Test
    void rejectsFilesWithoutRequiredColumns() {
        assertThatThrownBy(() -> read("code;name\n1;Skyr\n"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("import");
    }
}
