package com.mealplanner.server.off;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.zip.GZIPOutputStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class OffCandidatesExportTest {

    private static final String HEADER =
            "code;name;brand;kcal;protein;fat;carbs;unit;quantity;validation;reasons;import;url";

    private static final List<String> SAMPLE = List.of(
            "{\"code\":\"5900820000318\",\"product_name_pl\":\"Skyr naturalny\",\"product_name\":\"Natural skyr\","
                    + "\"brands\":\"Piątnica,Mlekpol\",\"quantity\":\"150 g\",\"countries_tags\":[\"en:poland\"],"
                    + "\"nutriments\":{\"energy-kcal_100g\":65,\"proteins_100g\":12,\"fat_100g\":0,\"carbohydrates_100g\":4.2}}",
            "{\"code\":\"5901234123457\",\"product_name\":\"Baton; \\\"Mocny\\\"\",\"countries_tags\":[\"en:poland\",\"en:germany\"],"
                    + "\"nutriments\":{\"energy-kj_100g\":\"2092\",\"proteins_100g\":\"5\",\"fat_100g\":25,\"carbohydrates_100g\":65}}",
            "{\"code\":\"96385074\",\"product_name_pl\":\"Jogurt w kJ\",\"countries_tags\":[\"en:poland\"],"
                    + "\"nutriments\":{\"energy-kcal_100g\":272,\"proteins_100g\":12,\"fat_100g\":0,\"carbohydrates_100g\":4.2}}",
            "{\"code\":\"036000291452\",\"product_name_pl\":\"Bez tłuszczu\",\"countries_tags\":[\"en:poland\"],"
                    + "\"nutriments\":{\"energy-kcal_100g\":65,\"proteins_100g\":12,\"carbohydrates_100g\":4.2}}",
            "{\"code\":\"5900820000318\",\"product_name_pl\":\"Skyr duplikat\",\"countries_tags\":[\"en:poland\"],"
                    + "\"nutriments\":{\"energy-kcal_100g\":65,\"proteins_100g\":12,\"fat_100g\":0,\"carbohydrates_100g\":4.2}}",
            "{\"code\":\"4000000000000\",\"product_name\":\"German only\",\"countries_tags\":[\"en:germany\"],"
                    + "\"nutriments\":{\"energy-kcal_100g\":65,\"proteins_100g\":12,\"fat_100g\":0,\"carbohydrates_100g\":4.2}}",
            "{\"code\":\"123\",\"countries_tags\":[\"en:poland\"],\"nutriments\":{\"energy-kcal_100g\":\"abc\"}}",
            "not json mentioning en:poland",
            ""
    );

    @TempDir
    Path tempDir;

    private Path writeDump(String fileName, boolean gzip) throws IOException {
        Path dump = tempDir.resolve(fileName);
        byte[] content = String.join("\n", SAMPLE).getBytes(StandardCharsets.UTF_8);
        try (OutputStream out = gzip ? new GZIPOutputStream(Files.newOutputStream(dump)) : Files.newOutputStream(dump)) {
            out.write(content);
        }
        return dump;
    }

    private List<String> readCsv(Path csv) throws IOException {
        byte[] bytes = Files.readAllBytes(csv);
        assertThat(bytes).startsWith(0xEF, 0xBB, 0xBF);
        return new String(bytes, 3, bytes.length - 3, StandardCharsets.UTF_8).lines().toList();
    }

    @Test
    void exportsEveryPolishProductWithValidationResult() throws IOException {
        Path csv = tempDir.resolve("candidates.csv");

        ExportSummary summary = OffCandidatesExport.export(writeDump("dump.jsonl.gz", true), csv);

        List<String> lines = readCsv(csv);
        assertThat(lines.getFirst()).isEqualTo(HEADER);
        assertThat(lines).hasSize(7);
        assertThat(lines.get(1)).isEqualTo("\"=\"\"5900820000318\"\"\";Skyr naturalny;Piątnica;65;12;0;4,2;100g;150 g;OK;;yes;"
                + "https://world.openfoodfacts.org/product/5900820000318");
        assertThat(lines.get(2)).startsWith("\"=\"\"5901234123457\"\"\";\"Baton; \"\"Mocny\"\"\";;500;5;25;65;100g;;OK;;yes;");
        assertThat(lines.get(3)).contains(";REJECTED;KCAL_LOOKS_LIKE_KJ;no;");
        assertThat(lines.get(4)).contains(";REJECTED;NUTRIENT_MISSING;no;");
        assertThat(lines.get(5)).startsWith("\"=\"\"5900820000318\"\"\";Skyr duplikat;").contains(";REJECTED;DUPLICATE_BAR_CODE;no;");
        assertThat(lines.get(6)).startsWith("\"=\"\"123\"\"\";;").contains(";REJECTED;NAME_MISSING,INVALID_BAR_CODE,NUTRIENT_MISSING;no;");

        assertThat(summary.polishProducts()).isEqualTo(6);
        assertThat(summary.accepted()).isEqualTo(2);
        assertThat(summary.rejected()).isEqualTo(4);
        assertThat(summary.skippedLines()).isEqualTo(1);
        assertThat(summary.rejectedByReason())
                .containsEntry("KCAL_LOOKS_LIKE_KJ", 1L)
                .containsEntry("NUTRIENT_MISSING", 2L)
                .containsEntry("DUPLICATE_BAR_CODE", 1L)
                .containsEntry("NAME_MISSING", 1L)
                .containsEntry("INVALID_BAR_CODE", 1L);
        assertThat(summary.estimatedTableBytes()).isEqualTo(2 * ExportSummary.ESTIMATED_BYTES_PER_PRODUCT);
    }

    @Test
    void readsUncompressedDumpsAndWritesASummaryFile() throws IOException {
        Path csv = tempDir.resolve("candidates.csv");

        OffCandidatesExport.main(new String[]{writeDump("dump.jsonl", false).toString(), csv.toString()});

        assertThat(readCsv(csv)).hasSize(7);
        String summary = Files.readString(tempDir.resolve("candidates.csv.summary.txt"));
        assertThat(summary)
                .contains("Polish products: 6")
                .contains("Accepted: 2")
                .contains("Rejected: 4")
                .contains("NUTRIENT_MISSING: 2")
                .contains("Skipped lines: 1")
                .contains("Estimated table size: 0.0 MB");
    }

    @Test
    void keepsWarningsAcceptsCodesOfRejectedRowsAndIgnoresPolandOutsideCountries() throws IOException {
        Path dump = tempDir.resolve("edge.jsonl");
        Files.write(dump, List.of(
                "{\"code\":\"5900820000318\",\"product_name\":\"Bez makro\",\"countries_tags\":[\"en:poland\"],"
                        + "\"nutriments\":{\"energy-kcal_100g\":65}}",
                "{\"code\":\"5900820000318\",\"product_name\":\"Z ostrzezeniem\",\"countries_tags\":[\"en:poland\"],"
                        + "\"nutriments\":{\"energy-kcal_100g\":85,\"proteins_100g\":12,\"fat_100g\":0,\"carbohydrates_100g\":4.2}}",
                "{\"code\":\"5901234123457\",\"product_name\":\"Origin only\",\"origins_tags\":[\"en:poland\"],"
                        + "\"countries_tags\":\"en:poland\",\"nutriments\":{}}"));
        Path csv = tempDir.resolve("edge.csv");

        ExportSummary summary = OffCandidatesExport.export(dump, csv);

        List<String> lines = readCsv(csv);
        assertThat(lines).hasSize(3);
        assertThat(lines.get(2)).contains(";OK;KCAL_DEVIATION;yes;");
        assertThat(summary.polishProducts()).isEqualTo(2);
        assertThat(summary.accepted()).isEqualTo(1);
    }

    @Test
    void keepsTextFromTheDumpFromRunningAsSpreadsheetFormulas() throws IOException {
        Path dump = tempDir.resolve("formulas.jsonl");
        Files.write(dump, List.of(
                "{\"code\":\"=1+1\",\"product_name\":\"=HYPERLINK(\\\"http://example.com\\\")\",\"brands\":\"+48 Foods\","
                        + "\"quantity\":\"=1+1\",\"countries_tags\":[\"en:poland\"],\"nutriments\":{}}",
                "{\"code\":\"5900820000318\",\"product_name\":\"@SUM\",\"brands\":\"-Brand\","
                        + "\"quantity\":\"'quoted\",\"countries_tags\":[\"en:poland\"],\"nutriments\":{}}"));
        Path csv = tempDir.resolve("formulas.csv");

        OffCandidatesExport.export(dump, csv);

        List<String> lines = readCsv(csv);
        assertThat(lines.get(1)).startsWith("'=1+1;\"'=HYPERLINK(\"\"http://example.com\"\")\";'+48 Foods;;;;;100g;'=1+1;");
        assertThat(lines.get(2)).startsWith("\"=\"\"5900820000318\"\"\";'@SUM;'-Brand;;;;;100g;''quoted;");
    }

    @Test
    void readsCellsBackToTheOriginalText() {
        assertThat(OffCandidatesExport.readCell("=\"036000291452\"")).isEqualTo("036000291452");
        assertThat(OffCandidatesExport.readCell("036000291452")).isEqualTo("036000291452");
        assertThat(OffCandidatesExport.readCell("'=1+1")).isEqualTo("=1+1");
        assertThat(OffCandidatesExport.readCell("''quoted")).isEqualTo("'quoted");
        assertThat(OffCandidatesExport.readCell("'plain")).isEqualTo("'plain");
        assertThat(OffCandidatesExport.readCell("'")).isEqualTo("'");
        assertThat(OffCandidatesExport.readCell("Skyr")).isEqualTo("Skyr");
        assertThat(OffCandidatesExport.readCell("")).isEmpty();
    }

    @Test
    void treatsNonFiniteNumbersAsMissingAndKeepsExporting() throws IOException {
        Path dump = tempDir.resolve("numbers.jsonl");
        Files.write(dump, List.of(
                "{\"code\":\"5900820000318\",\"product_name\":\"Nan\",\"countries_tags\":[\"en:poland\"],"
                        + "\"nutriments\":{\"energy-kcal_100g\":65,\"proteins_100g\":\"NaN\",\"fat_100g\":0,\"carbohydrates_100g\":4.2}}",
                "{\"code\":\"5901234123457\",\"product_name\":\"Huge\",\"countries_tags\":[\"en:poland\"],"
                        + "\"nutriments\":{\"energy-kcal_100g\":65,\"proteins_100g\":\"1e400\",\"fat_100g\":1e400,\"carbohydrates_100g\":4.2}}",
                "{\"code\":\"96385074\",\"product_name\":\"Infinite kJ\",\"countries_tags\":[\"en:poland\"],"
                        + "\"nutriments\":{\"energy-kj_100g\":\"Infinity\",\"proteins_100g\":12,\"fat_100g\":0,\"carbohydrates_100g\":4.2}}",
                "{\"code\":\"036000291452\",\"product_name\":\"Skyr\",\"countries_tags\":[\"en:poland\"],"
                        + "\"nutriments\":{\"energy-kcal_100g\":65,\"proteins_100g\":12,\"fat_100g\":0,\"carbohydrates_100g\":4.2}}"));
        Path csv = tempDir.resolve("numbers.csv");

        ExportSummary summary = OffCandidatesExport.export(dump, csv);

        List<String> lines = readCsv(csv);
        assertThat(lines).hasSize(5);
        assertThat(lines.get(1)).contains(";Nan;;65;;0;4,2;").contains(";REJECTED;NUTRIENT_MISSING;no;");
        assertThat(lines.get(2)).contains(";Huge;;65;;;4,2;").contains(";REJECTED;NUTRIENT_MISSING;no;");
        assertThat(lines.get(3)).contains(";Infinite kJ;;;12;0;4,2;").contains(";REJECTED;NUTRIENT_MISSING;no;");
        assertThat(lines.get(4)).contains(";Skyr;").contains(";OK;;yes;");
        assertThat(summary.accepted()).isEqualTo(1);
    }

    @Test
    void explainsUsageWhenArgumentsAreMissing() {
        assertThatThrownBy(() -> OffCandidatesExport.main(new String[]{"only-input.jsonl"}))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Usage");
    }
}
