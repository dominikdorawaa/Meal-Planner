package com.mealplanner.server.off;

import com.mealplanner.server.product.NutritionCheck;
import com.mealplanner.server.product.NutritionIssue;
import com.mealplanner.server.product.NutritionRounding;
import com.mealplanner.server.product.NutritionValidator;
import com.mealplanner.server.product.Product;
import com.mealplanner.server.product.ProductRepository;
import com.mealplanner.server.product.ProductSource;
import com.mealplanner.server.product.ProductStatus;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import java.io.IOException;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.TreeMap;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class OffImportService {

    static final int BATCH_SIZE = 500;
    static final int MAX_TEXT_LENGTH = 255;

    private final ProductRepository productRepository;
    private final JdbcTemplate jdbcTemplate;
    private final TransactionTemplate transactionTemplate;

    public ImportReport importReviewed(Path csv) throws IOException {
        Progress progress = new Progress();
        Set<String> seenCodes = new HashSet<>();
        List<ReviewedRow> batch = new ArrayList<>();

        ReviewedCsvReader.read(csv, row -> {
            progress.read++;
            if (!row.selected()) {
                return;
            }
            progress.selected++;
            List<String> errors = errors(row, seenCodes);
            if (!errors.isEmpty()) {
                progress.skippedInvalid++;
                errors.forEach(reason -> progress.invalidByReason.merge(reason, 1L, Long::sum));
                return;
            }
            batch.add(row);
            if (batch.size() == BATCH_SIZE) {
                saveBatch(batch, progress);
                batch.clear();
            }
        });
        if (!batch.isEmpty()) {
            saveBatch(batch, progress);
        }

        Long tableBytes = jdbcTemplate.queryForObject("SELECT pg_total_relation_size('products')", Long.class);
        return new ImportReport(progress.read, progress.selected, progress.inserted, progress.updated,
                progress.unchanged, progress.skippedInvalid, progress.skippedProtected, progress.invalidByReason,
                tableBytes == null ? 0 : tableBytes);
    }

    private static List<String> errors(ReviewedRow row, Set<String> seenCodes) {
        if (row.code().isEmpty()) {
            return List.of(NutritionIssue.INVALID_BAR_CODE.name());
        }
        NutritionCheck check = NutritionValidator.check(row.name(), row.kcal(), row.protein(), row.fat(),
                row.carbs(), row.unit(), row.code());
        if (!check.isValid()) {
            return check.errors().stream().map(NutritionIssue::name).toList();
        }
        if (!seenCodes.add(row.code())) {
            return List.of(OffCandidatesExport.DUPLICATE_BAR_CODE);
        }
        return List.of();
    }

    private void saveBatch(List<ReviewedRow> rows, Progress progress) {
        transactionTemplate.executeWithoutResult(status -> {
            Map<String, Product> existing = productRepository
                    .findByBarCodeInAndStatusAndDeletedAtIsNull(rows.stream().map(ReviewedRow::code).toList(),
                            ProductStatus.VERIFIED)
                    .stream()
                    .collect(Collectors.toMap(Product::getBarCode, Function.identity()));
            List<Product> toSave = new ArrayList<>();
            for (ReviewedRow row : rows) {
                Product product = existing.get(row.code());
                if (product == null) {
                    product = new Product();
                    product.setBarCode(row.code());
                    product.setStatus(ProductStatus.VERIFIED);
                    product.setSource(ProductSource.OPEN_FOOD_FACTS);
                    row.extras().cleanedFor(row.fat(), row.carbs()).applyTo(product);
                    product.setPackageWeight(row.packageWeight());
                    apply(product, row);
                    toSave.add(product);
                    progress.inserted++;
                } else if (product.getSource() != ProductSource.OPEN_FOOD_FACTS) {
                    progress.skippedProtected++;
                } else if (apply(product, row)) {
                    toSave.add(product);
                    progress.updated++;
                } else {
                    progress.unchanged++;
                }
            }
            productRepository.saveAll(toSave);
        });
    }

    private static boolean apply(Product product, ReviewedRow row) {
        String name = shorten(row.name());
        String brand = row.brand().isEmpty() ? null : shorten(row.brand());
        boolean changed = !Objects.equals(product.getName(), name)
                || !Objects.equals(product.getBrand(), brand)
                || !Objects.equals(product.getKcal(), NutritionRounding.kcal(row.kcal()))
                || !Objects.equals(product.getProtein(), NutritionRounding.grams(row.protein()))
                || !Objects.equals(product.getFat(), NutritionRounding.grams(row.fat()))
                || !Objects.equals(product.getCarbs(), NutritionRounding.grams(row.carbs()))
                || !Objects.equals(product.getUnit(), row.unit());
        product.setName(name);
        product.setBrand(brand);
        product.setKcal(NutritionRounding.kcal(row.kcal()));
        product.setProtein(NutritionRounding.grams(row.protein()));
        product.setFat(NutritionRounding.grams(row.fat()));
        product.setCarbs(NutritionRounding.grams(row.carbs()));
        product.setUnit(row.unit());
        return changed;
    }

    private static String shorten(String text) {
        return text.codePointCount(0, text.length()) > MAX_TEXT_LENGTH
                ? text.substring(0, text.offsetByCodePoints(0, MAX_TEXT_LENGTH))
                : text;
    }

    private static final class Progress {
        long read;
        long selected;
        long inserted;
        long updated;
        long unchanged;
        long skippedInvalid;
        long skippedProtected;
        final Map<String, Long> invalidByReason = new TreeMap<>();
    }
}
