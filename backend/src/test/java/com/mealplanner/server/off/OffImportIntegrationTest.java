package com.mealplanner.server.off;

import com.mealplanner.server.TestcontainersConfiguration;
import com.mealplanner.server.product.Product;
import com.mealplanner.server.product.ProductRepository;
import com.mealplanner.server.product.ProductSource;
import com.mealplanner.server.product.ProductStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@Import(TestcontainersConfiguration.class)
class OffImportIntegrationTest {

    private static final String HEADER = "code;name;brand;kcal;protein;fat;carbs;unit;quantity;validation;reasons;import;url";

    @Autowired
    private OffImportService importService;

    @Autowired
    private ProductRepository productRepository;

    @TempDir
    Path tempDir;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void clearProducts() {
        jdbcTemplate.update("delete from user_meals");
        jdbcTemplate.update("delete from products");
    }

    private Path csv(String... rows) throws IOException {
        Path file = tempDir.resolve("reviewed-" + System.nanoTime() + ".csv");
        Files.writeString(file, "﻿" + HEADER + "\r\n" + String.join("\r\n", rows) + "\r\n", StandardCharsets.UTF_8);
        return file;
    }

    private Product userProduct(String barCode, ProductStatus status) {
        Product product = new Product();
        product.setName("User product");
        product.setBarCode(barCode);
        product.setKcal(65.0);
        product.setProtein(12.0);
        product.setFat(0.0);
        product.setCarbs(4.2);
        product.setStatus(status);
        product.setSource(ProductSource.USER);
        return productRepository.save(product);
    }

    private Product byBarCode(String barCode) {
        return productRepository.findByBarCodeAndStatusAndDeletedAtIsNull(barCode, ProductStatus.VERIFIED).orElseThrow();
    }

    @Test
    void roundsNutritionValuesSoRepeatedImportsChangeNothing() throws IOException {
        Path file = csv("5900820000318;Skyr naturalny;Piątnica;64,6;12,04;0,0001;4,19999980927;100g;;OK;;yes;");

        importService.importReviewed(file);
        ImportReport second = importService.importReviewed(file);

        Product skyr = byBarCode("5900820000318");
        assertThat(skyr.getKcal()).isEqualTo(65.0);
        assertThat(skyr.getProtein()).isEqualTo(12.0);
        assertThat(skyr.getFat()).isEqualTo(0.0);
        assertThat(skyr.getCarbs()).isEqualTo(4.2);
        assertThat(second.unchanged()).isEqualTo(1);
        assertThat(second.updated()).isZero();
    }

    @Test
    void importsSelectedValidProductsAsVerifiedOpenFoodFactsProducts() throws IOException {
        ImportReport report = importService.importReviewed(csv(
                "5900820000318;Skyr naturalny;Piątnica;65;12;0;4,2;100g;150 g;OK;;yes;",
                "5901234123457;Czekolada gorzka;Wedel;546;4,9;31;61;100g;;OK;;no;",
                "96385074;Napój w kJ;;180;0;0;11;100g;;REJECTED;KCAL_LOOKS_LIKE_KJ;yes;"));

        Product skyr = byBarCode("5900820000318");
        assertThat(skyr.getName()).isEqualTo("Skyr naturalny");
        assertThat(skyr.getBrand()).isEqualTo("Piątnica");
        assertThat(skyr.getCarbs()).isEqualTo(4.2);
        assertThat(skyr.getUnit()).isEqualTo("100g");
        assertThat(skyr.getSource()).isEqualTo(ProductSource.OPEN_FOOD_FACTS);
        assertThat(skyr.getCreatedBy()).isNull();
        assertThat(skyr.getSearchText()).isEqualTo("skyr naturalny piatnica");
        assertThat(productRepository.count()).isEqualTo(1);

        assertThat(report.read()).isEqualTo(3);
        assertThat(report.selected()).isEqualTo(2);
        assertThat(report.inserted()).isEqualTo(1);
        assertThat(report.updated()).isZero();
        assertThat(report.skippedInvalid()).isEqualTo(1);
        assertThat(report.invalidByReason()).containsEntry("KCAL_LOOKS_LIKE_KJ", 1L);
        assertThat(report.tableBytes()).isPositive();
    }

    @Test
    void runningTheSameImportAgainChangesNothing() throws IOException {
        Path file = csv("5900820000318;Skyr naturalny;Piątnica;65;12;0;4,2;100g;;OK;;yes;");
        importService.importReviewed(file);
        Product first = byBarCode("5900820000318");

        ImportReport second = importService.importReviewed(file);

        assertThat(second.inserted()).isZero();
        assertThat(second.updated()).isZero();
        assertThat(second.unchanged()).isEqualTo(1);
        assertThat(productRepository.count()).isEqualTo(1);
        assertThat(byBarCode("5900820000318").getId()).isEqualTo(first.getId());
    }

    @Test
    void updatesProductsThatCameFromOpenFoodFacts() throws IOException {
        importService.importReviewed(csv("5900820000318;Skyr naturalny;Piątnica;65;12;0;4,2;100g;;OK;;yes;"));

        ImportReport report = importService.importReviewed(
                csv("5900820000318;Skyr naturalny wanilia;Piątnica;80;10;0;10;100g;;OK;;yes;"));

        assertThat(report.updated()).isEqualTo(1);
        Product skyr = byBarCode("5900820000318");
        assertThat(skyr.getName()).isEqualTo("Skyr naturalny wanilia");
        assertThat(skyr.getKcal()).isEqualTo(80.0);
        assertThat(skyr.getSearchText()).isEqualTo("skyr naturalny wanilia piatnica");
    }

    @Test
    void neverOverwritesVerifiedProductsAddedByUsers() throws IOException {
        Product own = userProduct("5900820000318", ProductStatus.VERIFIED);

        ImportReport report = importService.importReviewed(
                csv("5900820000318;Skyr z OFF;Piątnica;70;11;0;5;100g;;OK;;yes;"));

        assertThat(report.skippedProtected()).isEqualTo(1);
        assertThat(byBarCode("5900820000318").getId()).isEqualTo(own.getId());
        assertThat(byBarCode("5900820000318").getName()).isEqualTo("User product");
    }

    @Test
    void addsVerifiedProductNextToPendingOneWithTheSameCode() throws IOException {
        Product pending = userProduct("5900820000318", ProductStatus.PENDING);

        ImportReport report = importService.importReviewed(
                csv("5900820000318;Skyr z OFF;Piątnica;70;11;0;5;100g;;OK;;yes;"));

        assertThat(report.inserted()).isEqualTo(1);
        assertThat(byBarCode("5900820000318").getSource()).isEqualTo(ProductSource.OPEN_FOOD_FACTS);
        assertThat(productRepository.findById(pending.getId()).orElseThrow().getStatus()).isEqualTo(ProductStatus.PENDING);
    }

    @Test
    void skipsRepeatedCodesWithinOneFileAndShortensLongTexts() throws IOException {
        String longName = "N".repeat(300);

        ImportReport report = importService.importReviewed(csv(
                "5900820000318;" + longName + ";" + "B".repeat(300) + ";65;12;0;4,2;100g;;OK;;yes;",
                "5900820000318;Skyr drugi;;65;12;0;4,2;100g;;OK;;yes;"));

        assertThat(report.inserted()).isEqualTo(1);
        assertThat(report.invalidByReason()).containsEntry("DUPLICATE_BAR_CODE", 1L);
        Product product = byBarCode("5900820000318");
        assertThat(product.getName()).hasSize(255);
        assertThat(product.getBrand()).hasSize(255);
    }

    @Test
    void shortensTextWithoutSplittingCharacters() throws IOException {
        String emoji = new String(Character.toChars(0x1F95B));
        String name = "a".repeat(254) + emoji + "b";

        importService.importReviewed(csv("5900820000318;" + name + ";;65;12;0;4,2;100g;;OK;;yes;"));

        assertThat(byBarCode("5900820000318").getName()).isEqualTo("a".repeat(254) + emoji);
    }

    @Test
    void importsManyProductsInBatches() throws IOException {
        List<String> rows = new ArrayList<>();
        for (int i = 0; i < OffImportService.BATCH_SIZE + 5; i++) {
            String code = withCheckDigit(String.format("590%09d", i));
            rows.add(code + ";Produkt " + i + ";;65;12;0;4,2;100g;;OK;;yes;");
        }

        ImportReport report = importService.importReviewed(csv(rows.toArray(String[]::new)));

        assertThat(report.inserted()).isEqualTo(OffImportService.BATCH_SIZE + 5);
        assertThat(productRepository.count()).isEqualTo(OffImportService.BATCH_SIZE + 5);
    }

    private static String withCheckDigit(String twelveDigits) {
        int sum = 0;
        for (int i = 0; i < 12; i++) {
            int digit = twelveDigits.charAt(i) - '0';
            sum += i % 2 == 0 ? digit : digit * 3;
        }
        return twelveDigits + (10 - sum % 10) % 10;
    }
}
