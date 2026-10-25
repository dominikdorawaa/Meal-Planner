package com.mealplanner.server.off;

import com.mealplanner.server.product.MeasureKind;
import com.mealplanner.server.product.MeasureKindRepository;
import com.mealplanner.server.product.NutritionRounding;
import com.mealplanner.server.product.PackageWeight;
import com.mealplanner.server.product.Product;
import com.mealplanner.server.product.ProductMeasures;
import com.mealplanner.server.product.ProductRepository;
import com.mealplanner.server.product.ProductSource;
import com.mealplanner.server.product.ProductStatus;
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
            WHERE id IN (%s) AND EXISTS (SELECT 1 FROM user_meals m WHERE m.product_id = products.id)
            """;
    static final String DELETE_UNUSED = "DELETE FROM products WHERE id IN (%s) AND deleted_at IS NULL";
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
                tableBytes == null ? 0 : tableBytes);
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
            MeasureKind packageKind = measureKindRepository.findById(ProductMeasures.PACKAGE).orElse(null);
            for (OffProduct offProduct : products) {
                Product product = existing.get(offProduct.code());
                if (product == null) {
                    toSave.add(newProduct(offProduct, packageKind));
                    progress.inserted++;
                } else if (product.getDeletedAt() != null) {
                    progress.skip(List.of(DELETED_IN_APP));
                } else if (product.getSource() != ProductSource.OPEN_FOOD_FACTS) {
                    progress.skip(List.of(ADDED_BY_USER));
                } else if (apply(product, offProduct)) {
                    toSave.add(product);
                    progress.updated++;
                } else {
                    progress.unchanged++;
                }
            }
            productRepository.saveAll(toSave);
        });
    }

    private static Product newProduct(OffProduct offProduct, MeasureKind packageKind) {
        Product product = new Product();
        product.setBarCode(offProduct.code());
        product.setStatus(ProductStatus.VERIFIED);
        product.setSource(ProductSource.OPEN_FOOD_FACTS);
        offProduct.extras().cleanedFor(offProduct.fat(), offProduct.carbs()).applyTo(product);
        Double packageWeight = PackageWeight.parse(offProduct.quantity(), OffImportRules.UNIT);
        if (packageWeight != null && packageKind != null) {
            product.addMeasure(packageKind, packageWeight);
        }
        apply(product, offProduct);
        return product;
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
                || !Objects.equals(product.getUnit(), OffImportRules.UNIT);
        product.setName(name);
        product.setBrand(brand);
        product.setKcal(NutritionRounding.kcal(offProduct.kcal()));
        product.setProtein(NutritionRounding.grams(offProduct.protein()));
        product.setFat(NutritionRounding.grams(offProduct.fat()));
        product.setCarbs(NutritionRounding.grams(offProduct.carbs()));
        product.setUnit(OffImportRules.UNIT);
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
