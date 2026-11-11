package com.calendories.server.off;

import com.calendories.server.product.MeasureKind;
import com.calendories.server.product.MeasureKindRepository;
import com.calendories.server.product.NutritionRounding;
import com.calendories.server.product.Product;
import com.calendories.server.product.ProductMeasures;
import com.calendories.server.product.ProductRepository;
import com.calendories.server.product.ProductSource;
import com.calendories.server.product.ProductStatus;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.core.JacksonException;

import java.io.BufferedReader;
import java.io.IOException;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.TreeMap;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class OffImportService {

    static final int BATCH_SIZE = 500;
    static final Set<String> SWITCHABLE_UNITS = Set.of(OffMeasures.MASS_UNIT, OffMeasures.VOLUME_UNIT);
    static final int MAX_TEXT_LENGTH = 255;
    static final String UNREADABLE_LINE = "UNREADABLE_LINE";
    static final String ADDED_BY_USER = "ADDED_BY_USER";
    static final String DELETED_IN_APP = "DELETED_IN_APP";
    static final String OPEN_FOOD_FACTS_PRODUCTS = """
            SELECT id, bar_code, name FROM products
            WHERE source = 'OPEN_FOOD_FACTS' AND deleted_at IS NULL
            """;
    static final String LOCK_PRODUCTS = "SELECT id FROM products WHERE id IN (%s) FOR UPDATE";
    static final String HIDE_USED = """
            UPDATE products SET deleted_at = now()
            WHERE id IN (%s) AND (EXISTS (SELECT 1 FROM user_meals m WHERE m.product_id = products.id)
                OR EXISTS (SELECT 1 FROM recipe_ingredients r WHERE r.product_id = products.id)
                OR EXISTS (SELECT 1 FROM saved_products s WHERE s.product_id = products.id))
            """;
    static final String DELETE_UNUSED = "DELETE FROM products WHERE id IN (%s) AND deleted_at IS NULL";
    static final String SWITCH_MEAL_MEASURE =
            "UPDATE user_meals SET measure_code = ? WHERE product_id = ? AND measure_code = ?";
    static final String SWITCH_INGREDIENT_UNIT =
            "UPDATE recipe_ingredients SET unit = ? WHERE product_id = ? AND unit = ?";
    static final String MEASURE_COVERAGE = """
            SELECT COUNT(*) AS products,
                   COUNT(*) FILTER (WHERE p.unit = '100ml') AS in_milliliters,
                   COUNT(*) FILTER (WHERE NOT EXISTS (
                       SELECT 1 FROM product_measures m WHERE m.product_id = p.id)) AS only_base,
                   COUNT(*) FILTER (WHERE EXISTS (
                       SELECT 1 FROM product_measures m WHERE m.product_id = p.id AND m.kind_code = 'package'))
                       AS with_package,
                   COUNT(*) FILTER (WHERE EXISTS (
                       SELECT 1 FROM product_measures m WHERE m.product_id = p.id AND m.kind_code = 'piece'))
                       AS with_piece,
                   COUNT(*) FILTER (WHERE EXISTS (
                       SELECT 1 FROM product_measures m WHERE m.product_id = p.id
                       AND m.kind_code NOT IN ('package', 'piece'))) AS with_other
            FROM products p
            WHERE p.source = 'OPEN_FOOD_FACTS' AND p.deleted_at IS NULL
            """;
    static final String COUNT_DUPLICATES = "SELECT COUNT(*) - COUNT(DISTINCT " + ProductRepository.DUPLICATE_KEY
            + ") FROM products p WHERE p.source = 'OPEN_FOOD_FACTS' AND p.deleted_at IS NULL AND p.status = 'VERIFIED'";

    private final ProductRepository productRepository;
    private final MeasureKindRepository measureKindRepository;
    private final JdbcTemplate jdbcTemplate;
    private final TransactionTemplate transactionTemplate;

    public ImportReport importDump(Path dump) throws IOException {
        Progress progress = new Progress();
        OffImportRules rules = new OffImportRules();
        List<OffProduct> batch = new ArrayList<>();

        try (BufferedReader reader = OffDump.open(dump)) {
            String line;
            while ((line = reader.readLine()) != null) {
                if (line.isBlank()) {
                    continue;
                }
                progress.read++;
                parse(line, progress).ifPresent(product -> {
                    progress.soldInPoland++;
                    OffImportRules.Decision decision = rules.check(product);
                    if (decision.accepted()) {
                        batch.add(product);
                        progress.acceptedCodes.add(product.code());
                    } else {
                        progress.skip(decision.errors());
                        progress.rejectedCodes.add(product.code());
                    }
                });
                if (batch.size() == BATCH_SIZE) {
                    saveBatch(batch, progress);
                    batch.clear();
                }
            }
        }
        if (!batch.isEmpty()) {
            saveBatch(batch, progress);
        }
        removeOutdated(progress);

        Long tableBytes = jdbcTemplate.queryForObject("SELECT pg_total_relation_size('products')", Long.class);
        Long duplicates = jdbcTemplate.queryForObject(COUNT_DUPLICATES, Long.class);
        return new ImportReport(progress.read, progress.soldInPoland, progress.inserted, progress.updated,
                progress.unchanged, progress.skipped, progress.skippedByReason, progress.removed,
                progress.hiddenInUse, duplicates == null ? 0 : duplicates, productRepository.count(),
                tableBytes == null ? 0 : tableBytes, measureCoverage());
    }

    public MeasureCoverage measureCoverage() {
        return jdbcTemplate.queryForObject(MEASURE_COVERAGE, (row, number) -> new MeasureCoverage(
                row.getLong("products"), row.getLong("in_milliliters"), row.getLong("only_base"),
                row.getLong("with_package"), row.getLong("with_piece"), row.getLong("with_other")));
    }

    private void removeOutdated(Progress progress) {
        List<UUID> outdated = jdbcTemplate.query(OPEN_FOOD_FACTS_PRODUCTS, (row, number) -> new StoredProduct(
                        row.getObject("id", UUID.class), row.getString("bar_code"), row.getString("name")))
                .stream()
                .filter(product -> isOutdated(product, progress))
                .map(StoredProduct::id)
                .toList();
        for (int start = 0; start < outdated.size(); start += BATCH_SIZE) {
            List<UUID> ids = outdated.subList(start, Math.min(start + BATCH_SIZE, outdated.size()));
            String placeholders = String.join(",", Collections.nCopies(ids.size(), "?"));
            Object[] arguments = ids.toArray();
            transactionTemplate.executeWithoutResult(status -> {
                jdbcTemplate.queryForList(LOCK_PRODUCTS.formatted(placeholders), UUID.class, arguments);
                progress.hiddenInUse += jdbcTemplate.update(HIDE_USED.formatted(placeholders), arguments);
                progress.removed += jdbcTemplate.update(DELETE_UNUSED.formatted(placeholders), arguments);
            });
        }
    }

    private static boolean isOutdated(StoredProduct product, Progress progress) {
        if (progress.acceptedCodes.contains(product.barCode())) {
            return false;
        }
        return progress.rejectedCodes.contains(product.barCode())
                || OffNameRules.isForeignName(product.name())
                || OffNameRules.isJunkName(product.name());
    }

    private record StoredProduct(UUID id, String barCode, String name) {
    }

    private static Optional<OffProduct> parse(String line, Progress progress) {
        if (!OffProductParser.mightBePolish(line)) {
            return Optional.empty();
        }
        try {
            return OffProductParser.parse(line);
        } catch (JacksonException exception) {
            progress.skip(List.of(UNREADABLE_LINE));
            return Optional.empty();
        }
    }

    private void saveBatch(List<OffProduct> products, Progress progress) {
        transactionTemplate.executeWithoutResult(status -> {
            Map<String, Product> existing = productRepository
                    .findByBarCodeInAndStatus(products.stream().map(OffProduct::code).toList(), ProductStatus.VERIFIED)
                    .stream()
                    .collect(Collectors.toMap(Product::getBarCode, Function.identity(),
                            (first, second) -> first.getDeletedAt() == null ? first : second));
            List<Product> toSave = new ArrayList<>();
            List<UnitSwitch> unitSwitches = new ArrayList<>();
            Map<String, MeasureKind> kinds = measureKindRepository.findAll().stream()
                    .collect(Collectors.toMap(MeasureKind::getCode, Function.identity()));
            for (OffProduct offProduct : products) {
                Product product = existing.get(offProduct.code());
                if (product == null) {
                    toSave.add(newProduct(offProduct, kinds));
                    progress.inserted++;
                } else if (product.getDeletedAt() != null) {
                    progress.skip(List.of(DELETED_IN_APP));
                } else if (product.getSource() != ProductSource.OPEN_FOOD_FACTS) {
                    progress.skip(List.of(ADDED_BY_USER));
                } else if (update(product, offProduct, kinds, unitSwitches)) {
                    toSave.add(product);
                    progress.updated++;
                } else {
                    progress.unchanged++;
                }
            }
            productRepository.saveAll(toSave);
            switchUnits(unitSwitches);
        });
    }

    private static Product newProduct(OffProduct offProduct, Map<String, MeasureKind> kinds) {
        Product product = new Product();
        product.setBarCode(offProduct.code());
        product.setStatus(ProductStatus.VERIFIED);
        product.setSource(ProductSource.OPEN_FOOD_FACTS);
        offProduct.extras().cleanedFor(offProduct.fat(), offProduct.carbs()).applyTo(product);
        apply(product, offProduct);
        OffMeasures.applyTo(product, OffMeasures.plan(offProduct), kinds);
        return product;
    }

    private static boolean update(Product product, OffProduct offProduct, Map<String, MeasureKind> kinds,
                                  List<UnitSwitch> unitSwitches) {
        String previousUnit = product.getUnit();
        boolean changed = apply(product, offProduct);
        if (!Objects.equals(previousUnit, product.getUnit()) && SWITCHABLE_UNITS.contains(previousUnit)) {
            unitSwitches.add(new UnitSwitch(product.getId(), ProductMeasures.baseCode(previousUnit),
                    ProductMeasures.baseCode(product.getUnit())));
        }
        return OffMeasures.applyTo(product, OffMeasures.plan(offProduct), kinds) || changed;
    }

    private void switchUnits(List<UnitSwitch> unitSwitches) {
        if (unitSwitches.isEmpty()) {
            return;
        }
        List<Object[]> arguments = unitSwitches.stream()
                .map(change -> new Object[]{change.to(), change.productId(), change.from()})
                .toList();
        jdbcTemplate.batchUpdate(SWITCH_MEAL_MEASURE, arguments);
        jdbcTemplate.batchUpdate(SWITCH_INGREDIENT_UNIT, arguments);
    }

    private record UnitSwitch(UUID productId, String from, String to) {
    }

    private static boolean apply(Product product, OffProduct offProduct) {
        String name = shorten(offProduct.name());
        String brand = offProduct.brand().isEmpty() ? null : shorten(offProduct.brand());
        boolean changed = !Objects.equals(product.getName(), name)
                || !Objects.equals(product.getBrand(), brand)
                || !Objects.equals(product.getKcal(), NutritionRounding.kcal(offProduct.kcal()))
                || !Objects.equals(product.getProtein(), NutritionRounding.grams(offProduct.protein()))
                || !Objects.equals(product.getFat(), NutritionRounding.grams(offProduct.fat()))
                || !Objects.equals(product.getCarbs(), NutritionRounding.grams(offProduct.carbs()))
                || !Objects.equals(product.getUnit(), OffMeasures.unit(offProduct));
        product.setName(name);
        product.setBrand(brand);
        product.setKcal(NutritionRounding.kcal(offProduct.kcal()));
        product.setProtein(NutritionRounding.grams(offProduct.protein()));
        product.setFat(NutritionRounding.grams(offProduct.fat()));
        product.setCarbs(NutritionRounding.grams(offProduct.carbs()));
        product.setUnit(OffMeasures.unit(offProduct));
        return changed;
    }

    private static String shorten(String text) {
        return text.codePointCount(0, text.length()) > MAX_TEXT_LENGTH
                ? text.substring(0, text.offsetByCodePoints(0, MAX_TEXT_LENGTH))
                : text;
    }

    private static final class Progress {
        long read;
        long soldInPoland;
        long inserted;
        long updated;
        long unchanged;
        long skipped;
        long removed;
        long hiddenInUse;
        final Set<String> acceptedCodes = new HashSet<>();
        final Set<String> rejectedCodes = new HashSet<>();
        final Map<String, Long> skippedByReason = new TreeMap<>();

        void skip(List<String> reasons) {
            skipped++;
            reasons.forEach(reason -> skippedByReason.merge(reason, 1L, Long::sum));
        }
    }
}
