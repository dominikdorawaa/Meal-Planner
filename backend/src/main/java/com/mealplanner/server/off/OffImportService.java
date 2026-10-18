package com.mealplanner.server.off;

import com.mealplanner.server.product.NutritionRounding;
import com.mealplanner.server.product.PackageWeight;
import com.mealplanner.server.product.Product;
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
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.TreeMap;
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

    private final ProductRepository productRepository;
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
                    } else {
                        decision.errors().forEach(progress::skip);
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

        Long tableBytes = jdbcTemplate.queryForObject("SELECT pg_total_relation_size('products')", Long.class);
        return new ImportReport(progress.read, progress.soldInPoland, progress.inserted, progress.updated,
                progress.unchanged, progress.skippedByReason, productRepository.count(),
                tableBytes == null ? 0 : tableBytes);
    }

    private static Optional<OffProduct> parse(String line, Progress progress) {
        if (!OffProductParser.mightBePolish(line)) {
            return Optional.empty();
        }
        try {
            return OffProductParser.parse(line);
        } catch (JacksonException exception) {
            progress.skip(UNREADABLE_LINE);
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
            for (OffProduct offProduct : products) {
                Product product = existing.get(offProduct.code());
                if (product == null) {
                    toSave.add(newProduct(offProduct));
                    progress.inserted++;
                } else if (product.getDeletedAt() != null) {
                    progress.skip(DELETED_IN_APP);
                } else if (product.getSource() != ProductSource.OPEN_FOOD_FACTS) {
                    progress.skip(ADDED_BY_USER);
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

    private static Product newProduct(OffProduct offProduct) {
        Product product = new Product();
        product.setBarCode(offProduct.code());
        product.setStatus(ProductStatus.VERIFIED);
        product.setSource(ProductSource.OPEN_FOOD_FACTS);
        offProduct.extras().cleanedFor(offProduct.fat(), offProduct.carbs()).applyTo(product);
        product.setPackageWeight(PackageWeight.parse(offProduct.quantity(), OffImportRules.UNIT));
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
        final Map<String, Long> skippedByReason = new TreeMap<>();

        void skip(String reason) {
            skippedByReason.merge(reason, 1L, Long::sum);
        }
    }
}
