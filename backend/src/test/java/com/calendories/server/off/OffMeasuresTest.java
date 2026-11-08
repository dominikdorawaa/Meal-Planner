package com.calendories.server.off;

import com.calendories.server.product.ExtraNutrients;
import com.calendories.server.product.MeasureKind;
import com.calendories.server.product.Product;
import com.calendories.server.product.ProductMeasure;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;

class OffMeasuresTest {

    private static OffProduct product(String quantity, Double productQuantity, String productQuantityUnit,
                                      String servingSize, Double servingQuantity, String servingQuantityUnit,
                                      String... categories) {
        return new OffProduct("5900000000001", "Produkt", "", 100.0, 1.0, 1.0, 1.0, ExtraNutrients.NONE, quantity,
                true, new OffMeasureFacts(productQuantity, productQuantityUnit, servingSize, servingQuantity,
                servingQuantityUnit, List.of(categories)));
    }

    private static String describe(List<OffMeasures.PlannedMeasure> plan) {
        return plan.stream()
                .map(measure -> measure.kindCode() + "=" + measure.baseAmount() + (measure.defaultMeasure() ? "*" : ""))
                .collect(Collectors.joining(" "));
    }

    @ParameterizedTest(name = "{0}")
    @CsvSource(delimiter = '|', nullValues = "null", value = {
            "drink with volume unit is in ml|330 ml|330.0|ml|en:beverages|100ml",
            "volume read from text when unit is missing|1 l|null|''|en:milks|100ml",
            "ice cream sold by volume stays in grams|1000 ml|1000.0|ml|en:ice-creams|100g",
            "drink sold by weight stays in grams|500 g|500.0|g|en:beverages|100g",
            "no data gives grams|''|null|''|null|100g"
    })
    void picksMillilitersOnlyForLiquidsSoldByVolume(String description, String quantity, Double productQuantity,
                                                    String productQuantityUnit, String category, String expected) {
        String[] categories = category == null ? new String[0] : new String[]{category};

        assertThat(OffMeasures.unit(product(quantity, productQuantity, productQuantityUnit, "", null, "",
                categories))).isEqualTo(expected);
    }

    @ParameterizedTest(name = "{0}")
    @CsvSource(delimiter = '|', nullValues = "null", value = {
            "package from product quantity|150 g|150.0|g|''|null|''|''|package=150.0",
            "package parsed from text|1 kg|null|''|''|null|''|''|package=1000.0",
            "drink package in ml|330 ml|330.0|ml|''|null|''|en:beverages|cup=250.0 package=330.0",
            "plain serving|500 g|500.0|g|30g|30.0|g|''|serving=30.0* package=500.0",
            "named bar is the default|90 g|90.0|g|1 baton (45 g)|45.0|g|''|bar=45.0* package=90.0",
            "several pieces are divided|200 g|200.0|g|2 ciastka (20 g)|20.0|g|''|piece=10.0* package=200.0",
            "slice of bread becomes a bread slice|500 g|500.0|g|1 slice (35 g)|35.0|g|en:breads|bread_slice=35.0* package=500.0",
            "spoon is not the default|250 g|250.0|g|1 łyżka (15 g)|15.0|g|''|tbsp=15.0 package=250.0",
            "drink portion in ml|1 l|1000.0|ml|1 portion (250 ml)|250.0|ml|en:beverages|serving=250.0* package=1000.0",
            "unit taken from serving text|400 g|400.0|g|1 portion (100 g)|100.0|''|''|serving=100.0* package=400.0",
            "serving in grams is ignored for ml product|1 l|1000.0|ml|250 g|250.0|g|en:beverages,en:fruit-juices|cup=250.0 package=1000.0",
            "serving without any unit is ignored|400 g|400.0|g|1 portion|100.0|''|''|package=400.0",
            "serving as big as the package is dropped|330 ml|330.0|ml|1 can (330 ml)|330.0|ml|en:beverages|cup=250.0 package=330.0",
            "serving bigger than the package is dropped|100 g|100.0|g|150 g|150.0|g|''|package=100.0",
            "unknown serving word keeps the whole serving|100 g|100.0|g|0 ciastek (10 g)|10.0|g|''|serving=10.0* package=100.0",
            "zero count of a named piece is ignored|100 g|100.0|g|0 ciastka (10 g)|10.0|g|''|package=100.0",
            "multipack gives a piece|400 g (4 x 100 g)|400.0|g|''|null|''|''|piece=100.0* package=400.0",
            "multipack with comma|30 g (20 x 1,5 g)|30.0|g|''|null|''|''|piece=1.5* package=30.0",
            "multipack count too long to read is ignored|400 g (999999999999 x 100 g)|400.0|g|''|null|''|''|package=400.0",
            "single pack is not a multipack|1 x 500 g|500.0|g|''|null|''|''|package=500.0",
            "piece and serving with the same weight keep the piece|400 g (4 x 100 g)|400.0|g|100 g|100.0|g|''|piece=100.0* package=400.0",
            "plain serving of 100 g only repeats nutrition per 100 g|500 g|500.0|g|100 g|100.0|g|''|package=500.0",
            "named serving of 100 g is kept|500 g|500.0|g|1 portion (100 g)|100.0|g|''|serving=100.0* package=500.0",
            "teaspoon above its limit is dropped|500 g|500.0|g|1 łyżeczka (100 g)|100.0|g|''|package=500.0",
            "huge serving without package is dropped|''|null|''|4007 g|4007.0|g|''|''",
            "tiny serving is dropped|50 g|50.0|g|0.5 g|0.5|g|''|package=50.0",
            "category measure without own data|10 szt|null|''|''|null|''|en:eggs|piece=60.0*",
            "bread category rule skips flatbreads|370 g|370.0|g|''|null|''|en:wheat-breads,en:flatbreads|package=370.0",
            "bread category rule for a loaf|500 g|500.0|g|''|null|''|en:wheat-breads|bread_slice=35.0* package=500.0",
            "wraps are pieces|370 g|370.0|g|6 wraps (370 g)|370.0|g|en:wheat-breads,en:flatbreads|piece=61.7* package=370.0",
            "category measure in ml|1 l|1000.0|ml|''|null|''|en:milks|cup=250.0 package=1000.0",
            "category measure for any unit|1 l|1000.0|ml|''|null|''|en:vegetable-oils|tbsp=10.0 package=1000.0",
            "category measure for another unit is skipped|500 g|500.0|g|''|null|''|en:milks|package=500.0",
            "category measure skipped when product has own serving|1 l|1000.0|ml|200 ml|200.0|ml|en:milks|serving=200.0* package=1000.0",
            "first category rule wins for the same measure|1 l|1000.0|ml|''|null|''|en:milks,en:beverages|cup=250.0 package=1000.0",
            "tiny package is ignored|0.5 g|0.5|g|''|null|''|''|''",
            "tiny package from text is ignored|0.5 g|null|''|''|null|''|''|''"
    })
    void plansMeasuresFromOpenFoodFactsData(String description, String quantity, Double productQuantity,
                                            String productQuantityUnit, String servingSize, Double servingQuantity,
                                            String servingQuantityUnit, String categories, String expected) {
        String[] tags = categories.isEmpty() ? new String[0] : categories.split(",");
        OffProduct product = product(quantity, productQuantity, productQuantityUnit, servingSize, servingQuantity,
                servingQuantityUnit, tags);

        assertThat(describe(OffMeasures.plan(product))).isEqualTo(expected);
    }

    @Test
    void ignoresMissingQuantityAndInvalidServing() {
        OffProduct product = product(null, null, "", "", Double.NaN, "g");

        assertThat(OffMeasures.plan(product)).isEmpty();
    }

    @Test
    void everyRuleUsesAKnownMeasureKind() {
        List<String> known = Arrays.asList("piece", "slice", "bread_slice", "tbsp", "tsp", "cup", "mug", "serving",
                "bar", "package");

        assertThat(OffMeasures.SERVING_WORDS.values()).allMatch(known::contains);
        assertThat(OffMeasures.CATEGORY_MEASURES).extracting(OffMeasures.CategoryMeasure::kindCode)
                .allMatch(known::contains);
    }

    private static MeasureKind kind(String code, double maxBaseAmount) {
        MeasureKind kind = new MeasureKind();
        kind.setCode(code);
        kind.setMaxBaseAmount(maxBaseAmount);
        return kind;
    }

    private static final Map<String, MeasureKind> KINDS = List.of(kind("piece", 5000), kind("serving", 5000),
                    kind("package", 50000), kind("tbsp", 10))
            .stream().collect(Collectors.toMap(MeasureKind::getCode, Function.identity()));

    @Test
    void addsMissingMeasuresAndMarksTheDefault() {
        Product product = new Product();

        boolean changed = OffMeasures.applyTo(product, List.of(
                new OffMeasures.PlannedMeasure("piece", 100, true),
                new OffMeasures.PlannedMeasure("package", 400, false)), KINDS);

        assertThat(changed).isTrue();
        assertThat(product.getStoredMeasures())
                .extracting(stored -> stored.getKind().getCode(), ProductMeasure::getBaseAmount,
                        ProductMeasure::isDefaultMeasure)
                .containsExactly(tuple("piece", 100.0, true),
                        tuple("package", 400.0, false));
    }

    @Test
    void keepsExistingMeasuresAndSkipsUnknownOrTooBigOnes() {
        Product product = new Product();
        product.addMeasure(KINDS.get("package"), 500);

        boolean changed = OffMeasures.applyTo(product, List.of(
                new OffMeasures.PlannedMeasure("package", 400, false),
                new OffMeasures.PlannedMeasure("cup", 250, false),
                new OffMeasures.PlannedMeasure("tbsp", 15, false)), KINDS);

        assertThat(changed).isFalse();
        assertThat(product.getStoredMeasures()).extracting(ProductMeasure::getBaseAmount).containsExactly(500.0);
    }

    @Test
    void skipsMeasuresThatClashWithTheStoredPackage() {
        Product product = new Product();
        product.addMeasure(KINDS.get("package"), 500);

        boolean changed = OffMeasures.applyTo(product, List.of(
                new OffMeasures.PlannedMeasure("piece", 500, true),
                new OffMeasures.PlannedMeasure("serving", 750, false),
                new OffMeasures.PlannedMeasure("tbsp", 10, false)), KINDS);

        assertThat(changed).isTrue();
        assertThat(product.getStoredMeasures())
                .extracting(stored -> stored.getKind().getCode(), ProductMeasure::getBaseAmount)
                .containsExactly(tuple("package", 500.0), tuple("tbsp", 10.0));
    }

    @Test
    void doesNotReplaceAnExistingDefault() {
        Product product = new Product();
        product.addMeasure(KINDS.get("serving"), 30);
        product.getStoredMeasures().getFirst().setDefaultMeasure(true);

        boolean changed = OffMeasures.applyTo(product, List.of(
                new OffMeasures.PlannedMeasure("piece", 10, true)), KINDS);

        assertThat(changed).isTrue();
        assertThat(product.getStoredMeasures()).extracting(ProductMeasure::isDefaultMeasure)
                .containsExactly(true, false);
    }

    @Test
    void marksAnExistingMeasureAsDefault() {
        Product product = new Product();
        product.addMeasure(KINDS.get("piece"), 100);

        boolean changed = OffMeasures.applyTo(product, List.of(
                new OffMeasures.PlannedMeasure("piece", 100, true)), KINDS);

        assertThat(changed).isTrue();
        assertThat(product.getStoredMeasures().getFirst().isDefaultMeasure()).isTrue();
    }
}
