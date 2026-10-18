package com.mealplanner.server.off;

import com.mealplanner.server.TestcontainersConfiguration;
import com.mealplanner.server.product.Product;
import com.mealplanner.server.product.ProductFilters;
import com.mealplanner.server.product.ProductRepository;
import com.mealplanner.server.product.ProductService;
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
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.zip.GZIPOutputStream;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@Import(TestcontainersConfiguration.class)
class OffImportIntegrationTest {

    private static final ProductFilters NO_FILTERS = new ProductFilters(null, null, null, null);

    @Autowired
    private OffImportService importService;

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private ProductService productService;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @TempDir
    Path tempDir;

    @BeforeEach
    void clearProducts() {
        jdbcTemplate.update("delete from user_meals");
        jdbcTemplate.update("delete from products");
    }

    private static String product(String code, String name, String brand, String quantity, double kcal,
                                  double protein, double fat, double carbs) {
        return "{\"code\":\"" + code + "\",\"product_name_pl\":\"" + name + "\",\"brands\":\"" + brand + "\","
                + "\"quantity\":\"" + quantity + "\",\"countries_tags\":[\"en:poland\"],\"nutriments\":{"
                + "\"energy-kcal_100g\":" + kcal + ",\"proteins_100g\":" + protein + ",\"fat_100g\":" + fat
                + ",\"carbohydrates_100g\":" + carbs + "}}";
    }

    private static String skyr(String name, double kcal) {
        return product("5900820000318", name, "Piątnica", "150 g", kcal, 12.04, 0.0001, 4.19999980927);
    }

    private Path dump(String... lines) throws IOException {
        Path file = tempDir.resolve("dump-" + System.nanoTime() + ".jsonl.gz");
        try (OutputStream out = new GZIPOutputStream(Files.newOutputStream(file))) {
            out.write(String.join("\n", lines).getBytes(StandardCharsets.UTF_8));
        }
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

    private List<String> searchNames(String query) {
        return productService.search(query, NO_FILTERS, 0, 20, null).items().stream().map(Product::getName).toList();
    }

    @Test
    void importsValidPolishProductsFromTheDumpAndMakesThemSearchable() throws IOException {
        ImportReport report = importService.importDump(dump(
                skyr("Skyr naturalny", 64.6),
                product("5901234123457", "Jogurt naturalny", "Bakoma", "400 g", 61, 4.3, 3, 4.5),
                product("5900512000015", "Mleko 2%", "Mlekovita", "1 l", 50, 3.2, 2, 4.8),
                product("96385074", "Napój w kJ", "", "", 180, 0, 0, 11),
                product("5900820000325", "???", "", "", 950, 12, 0, 4.2),
                "{\"code\":\"4000000000000\",\"product_name\":\"German only\",\"countries_tags\":[\"en:germany\"]}",
                "not json mentioning en:poland",
                ""));

        Product skyr = byBarCode("5900820000318");
        assertThat(skyr.getName()).isEqualTo("Skyr naturalny");
        assertThat(skyr.getBrand()).isEqualTo("Piątnica");
        assertThat(skyr.getKcal()).isEqualTo(65.0);
        assertThat(skyr.getProtein()).isEqualTo(12.0);
        assertThat(skyr.getFat()).isEqualTo(0.0);
        assertThat(skyr.getCarbs()).isEqualTo(4.2);
        assertThat(skyr.getUnit()).isEqualTo("100g");
        assertThat(skyr.getPackageWeight()).isEqualTo(150.0);
        assertThat(skyr.getSource()).isEqualTo(ProductSource.OPEN_FOOD_FACTS);
        assertThat(skyr.getCreatedBy()).isNull();
        assertThat(skyr.getSearchText()).isEqualTo("skyr naturalny piatnica");

        assertThat(report.read()).isEqualTo(7);
        assertThat(report.soldInPoland()).isEqualTo(5);
        assertThat(report.inserted()).isEqualTo(3);
        assertThat(report.skippedByReason())
                .containsEntry("KCAL_LOOKS_LIKE_KJ", 1L)
                .containsEntry(OffImportRules.NAME_JUNK, 1L)
                .containsEntry("KCAL_ABOVE_900", 1L)
                .containsEntry(OffImportService.UNREADABLE_LINE, 1L);
        assertThat(report.skipped()).isEqualTo(3);
        assertThat(report.describe()).contains("Skipped: 3 ");
        assertThat(report.tableRows()).isEqualTo(3);
        assertThat(report.tableBytes()).isPositive();

        assertThat(searchNames("jogurt")).containsExactly("Jogurt naturalny");
        assertThat(searchNames("mleko")).containsExactly("Mleko 2%");
        assertThat(searchNames("piatnica")).containsExactly("Skyr naturalny");
    }

    @Test
    void runningTheSameImportAgainChangesNothing() throws IOException {
        Path file = dump(skyr("Skyr naturalny", 64.6));
        importService.importDump(file);
        Product first = byBarCode("5900820000318");

        ImportReport second = importService.importDump(file);

        assertThat(second.inserted()).isZero();
        assertThat(second.updated()).isZero();
        assertThat(second.unchanged()).isEqualTo(1);
        assertThat(second.tableRows()).isEqualTo(1);
        assertThat(byBarCode("5900820000318").getId()).isEqualTo(first.getId());
    }

    @Test
    void updatesProductsThatCameFromOpenFoodFacts() throws IOException {
        importService.importDump(dump(skyr("Skyr naturalny", 64.6)));

        ImportReport report = importService.importDump(dump(
                product("5900820000318", "Skyr naturalny wanilia", "Piątnica", "", 80, 10, 0, 10)));

        assertThat(report.updated()).isEqualTo(1);
        Product skyr = byBarCode("5900820000318");
        assertThat(skyr.getName()).isEqualTo("Skyr naturalny wanilia");
        assertThat(skyr.getKcal()).isEqualTo(80.0);
        assertThat(skyr.getSearchText()).isEqualTo("skyr naturalny wanilia piatnica");
    }

    @Test
    void neverOverwritesVerifiedProductsAddedByUsers() throws IOException {
        Product own = userProduct("5900820000318", ProductStatus.VERIFIED);

        ImportReport report = importService.importDump(dump(skyr("Skyr z OFF", 64.6)));

        assertThat(report.skippedByReason()).containsEntry(OffImportService.ADDED_BY_USER, 1L);
        assertThat(byBarCode("5900820000318").getId()).isEqualTo(own.getId());
        assertThat(byBarCode("5900820000318").getName()).isEqualTo("User product");
    }

    @Test
    void doesNotBringBackProductsDeletedInTheApp() throws IOException {
        importService.importDump(dump(skyr("Skyr naturalny", 64.6)));
        Product deleted = byBarCode("5900820000318");
        deleted.setDeletedAt(OffsetDateTime.now());
        productRepository.save(deleted);

        ImportReport report = importService.importDump(dump(skyr("Skyr naturalny", 64.6)));

        assertThat(report.skippedByReason()).containsEntry(OffImportService.DELETED_IN_APP, 1L);
        assertThat(report.inserted()).isZero();
        assertThat(productRepository.count()).isEqualTo(1);
    }

    @Test
    void addsVerifiedProductNextToPendingOneWithTheSameCode() throws IOException {
        Product pending = userProduct("5900820000318", ProductStatus.PENDING);

        ImportReport report = importService.importDump(dump(skyr("Skyr z OFF", 64.6)));

        assertThat(report.inserted()).isEqualTo(1);
        assertThat(byBarCode("5900820000318").getSource()).isEqualTo(ProductSource.OPEN_FOOD_FACTS);
        assertThat(productRepository.findById(pending.getId()).orElseThrow().getStatus()).isEqualTo(ProductStatus.PENDING);
    }

    @Test
    void skipsRepeatedCodesWithinOneDumpAndShortensLongTexts() throws IOException {
        ImportReport report = importService.importDump(dump(
                product("5900820000318", "N".repeat(300), "B".repeat(300), "", 65, 12, 0, 4.2),
                skyr("Skyr drugi", 64.6)));

        assertThat(report.inserted()).isEqualTo(1);
        assertThat(report.skippedByReason()).containsEntry(OffImportRules.DUPLICATE_BAR_CODE, 1L);
        Product product = byBarCode("5900820000318");
        assertThat(product.getName()).hasSize(255);
        assertThat(product.getBrand()).hasSize(255);
    }

    @Test
    void shortensTextWithoutSplittingCharacters() throws IOException {
        String emoji = new String(Character.toChars(0x1F95B));
        String name = "a".repeat(254) + emoji + "b";

        importService.importDump(dump(product("5900820000318", name, "", "", 65, 12, 0, 4.2)));

        assertThat(byBarCode("5900820000318").getName()).isEqualTo("a".repeat(254) + emoji);
        assertThat(byBarCode("5900820000318").getBrand()).isNull();
    }

    @Test
    void importsManyProductsInBatches() throws IOException {
        List<String> lines = new ArrayList<>();
        for (int i = 0; i < OffImportService.BATCH_SIZE + 5; i++) {
            lines.add(product(withCheckDigit(String.format("590%09d", i)), "Produkt " + i, "", "", 65, 12, 0, 4.2));
        }

        ImportReport report = importService.importDump(dump(lines.toArray(String[]::new)));

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

    @Test
    void importsMoreNutrientsForNewProductsOnly() throws IOException {
        String first = "{\"code\":\"5900820000318\",\"product_name_pl\":\"Skyr\",\"countries_tags\":[\"en:poland\"],"
                + "\"nutriments\":{\"energy-kcal_100g\":65,\"proteins_100g\":12,\"fat_100g\":0.2,\"carbohydrates_100g\":4.2,"
                + "\"saturated-fat_100g\":0.14,\"sugars_100g\":4.04,\"salt_100g\":0.12}}";
        importService.importDump(dump(first));
        Product skyr = byBarCode("5900820000318");
        assertThat(skyr.getSaturatedFat()).isEqualTo(0.1);
        assertThat(skyr.getSugars()).isEqualTo(4.0);
        assertThat(skyr.getFiber()).isNull();
        assertThat(skyr.getSalt()).isEqualTo(0.1);

        ImportReport report = importService.importDump(dump(first.replace("4.04", "4.1")));

        assertThat(report.unchanged()).isEqualTo(1);
        assertThat(byBarCode("5900820000318").getSugars()).isEqualTo(4.0);
    }
}
