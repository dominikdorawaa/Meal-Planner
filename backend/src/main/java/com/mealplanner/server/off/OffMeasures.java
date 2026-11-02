package com.mealplanner.server.off;

import com.mealplanner.server.product.MeasureKind;
import com.mealplanner.server.product.PackageWeight;
import com.mealplanner.server.product.Product;
import com.mealplanner.server.product.ProductMeasure;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

public final class OffMeasures {

    public static final String MASS_UNIT = "100g";
    public static final String VOLUME_UNIT = "100ml";
    static final String GRAMS = "g";
    static final String MILLILITERS = "ml";
    static final String ANY_UNIT = "*";
    static final String PACKAGE = "package";
    static final String PIECE = "piece";
    static final String SLICE = "slice";
    static final String BREAD_SLICE = "bread_slice";
    static final String SERVING = "serving";
    static final String BREAD_CATEGORY = "en:breads";
    static final double MIN_BASE_AMOUNT = 1;
    static final double MAX_BASE_AMOUNT = 1000;
    static final double PER_HUNDRED_AMOUNT = 100;
    static final Map<String, Double> MAX_BASE_AMOUNTS = Map.of("tsp", 15.0, "tbsp", 30.0, "cup", 500.0,
            "mug", 500.0, SLICE, 100.0, BREAD_SLICE, 100.0, "bar", 250.0);
    static final List<String> DEFAULT_KINDS = List.of(PIECE, "bar", BREAD_SLICE, SLICE, SERVING);
    static final List<String> KIND_ORDER =
            List.of(PIECE, SLICE, BREAD_SLICE, "tbsp", "tsp", "cup", "mug", SERVING, "bar", PACKAGE);
    static final Set<String> VOLUME_CATEGORIES = Set.copyOf(lines("volume-categories.txt"));
    static final Map<String, String> SERVING_WORDS = lines("serving-words.txt").stream()
            .map(line -> line.split("\\s+"))
            .collect(Collectors.toUnmodifiableMap(parts -> parts[0], parts -> parts[1]));
    static final List<CategoryMeasure> CATEGORY_MEASURES = lines("category-measures.txt").stream()
            .map(line -> line.split("\\s+"))
            .map(parts -> new CategoryMeasure(parts[0], parts[1], Double.parseDouble(parts[2]), parts[3],
                    parts.length > 4 ? parts[4] : null))
            .toList();

    private static final Pattern MULTIPACK =
            Pattern.compile("(\\d+)\\s*[x×*]\\s*(\\d+(?:\\.\\d+)?)\\s*(kg|g|ml|cl|l)\\b");
    private static final Pattern SERVING_NAME = Pattern.compile("^(?:(\\d+(?:\\.\\d+)?)\\s*)?(\\p{L}+)");
    private static final Pattern SERVING_UNIT = Pattern.compile("\\d\\s*(g|ml)\\b");

    private OffMeasures() {
    }

    public record PlannedMeasure(String kindCode, double baseAmount, boolean defaultMeasure) {
    }

    record CategoryMeasure(String category, String kindCode, double baseAmount, String unit,
                           String excludedCategory) {

        boolean matches(List<String> categories, String baseCode) {
            return categories.contains(category)
                    && (excludedCategory == null || !categories.contains(excludedCategory))
                    && (ANY_UNIT.equals(unit) || baseCode.equals(unit));
        }
    }

    public static String unit(OffProduct product) {
        OffMeasureFacts facts = product.measureFacts();
        boolean liquid = facts.categories().stream().anyMatch(VOLUME_CATEGORIES::contains);
        boolean soldByVolume = MILLILITERS.equals(facts.productQuantityUnit())
                || facts.productQuantityUnit().isEmpty()
                && PackageWeight.parse(product.quantity(), VOLUME_UNIT) != null;
        return liquid && soldByVolume ? VOLUME_UNIT : MASS_UNIT;
    }

    public static List<PlannedMeasure> plan(OffProduct product) {
        String unit = unit(product);
        String baseCode = VOLUME_UNIT.equals(unit) ? MILLILITERS : GRAMS;
        Double packageAmount = packageAmount(product, unit, baseCode);
        Map<String, Double> amounts = new LinkedHashMap<>();
        if (packageAmount != null) {
            amounts.put(PACKAGE, packageAmount);
        }
        multipackPiece(product.quantity(), unit).ifPresent(amount -> add(amounts, PIECE, amount, packageAmount));
        serving(product, baseCode).ifPresent(serving ->
                add(amounts, serving.kindCode(), serving.baseAmount(), packageAmount));
        if (amounts.keySet().stream().allMatch(PACKAGE::equals)) {
            CATEGORY_MEASURES.stream()
                    .filter(measure -> measure.matches(product.measureFacts().categories(), baseCode))
                    .forEach(measure -> add(amounts, measure.kindCode(), measure.baseAmount(), packageAmount));
        }
        String defaultKind = DEFAULT_KINDS.stream().filter(amounts::containsKey).findFirst().orElse(null);
        return amounts.keySet().stream()
                .sorted(Comparator.comparingInt(OffMeasures::kindOrder))
                .map(kind -> new PlannedMeasure(kind, amounts.get(kind), kind.equals(defaultKind)))
                .toList();
    }

    public static boolean applyTo(Product product, List<PlannedMeasure> plan, Map<String, MeasureKind> kinds) {
        boolean changed = false;
        for (PlannedMeasure planned : plan) {
            MeasureKind kind = kinds.get(planned.kindCode());
            if (kind != null && find(product, kind.getCode()).isEmpty()
                    && planned.baseAmount() <= kind.getMaxBaseAmount()) {
                product.addMeasure(kind, planned.baseAmount());
                changed = true;
            }
        }
        if (product.getStoredMeasures().stream().noneMatch(ProductMeasure::isDefaultMeasure)) {
            Optional<ProductMeasure> defaultMeasure = plan.stream()
                    .filter(PlannedMeasure::defaultMeasure)
                    .findFirst()
                    .flatMap(planned -> find(product, planned.kindCode()));
            if (defaultMeasure.isPresent()) {
                defaultMeasure.get().setDefaultMeasure(true);
                changed = true;
            }
        }
        return changed;
    }

    private static Optional<ProductMeasure> find(Product product, String kindCode) {
        return product.getStoredMeasures().stream()
                .filter(stored -> stored.getKind().getCode().equals(kindCode))
                .findFirst();
    }

    private static Double packageAmount(OffProduct product, String unit, String baseCode) {
        OffMeasureFacts facts = product.measureFacts();
        if (facts.productQuantity() != null && baseCode.equals(facts.productQuantityUnit())) {
            double rounded = round(facts.productQuantity());
            return rounded >= MIN_BASE_AMOUNT && PackageWeight.isValid(rounded) ? rounded : null;
        }
        Double parsed = PackageWeight.parse(product.quantity(), unit);
        return parsed == null || parsed < MIN_BASE_AMOUNT ? null : parsed;
    }

    private static Optional<Double> multipackPiece(String quantity, String unit) {
        if (quantity == null) {
            return Optional.empty();
        }
        Matcher matcher = MULTIPACK.matcher(quantity.toLowerCase(Locale.ROOT).replace(',', '.'));
        if (!matcher.find() || Integer.parseInt(matcher.group(1)) < 2) {
            return Optional.empty();
        }
        return Optional.ofNullable(PackageWeight.parse(matcher.group(2) + " " + matcher.group(3), unit));
    }

    private static Optional<PlannedMeasure> serving(OffProduct product, String baseCode) {
        OffMeasureFacts facts = product.measureFacts();
        Double quantity = facts.servingQuantity();
        String size = facts.servingSize().toLowerCase(Locale.ROOT).replace(',', '.');
        if (quantity == null || !Double.isFinite(quantity) || quantity <= 0
                || !baseCode.equals(servingUnit(facts.servingQuantityUnit(), size))) {
            return Optional.empty();
        }
        Matcher matcher = SERVING_NAME.matcher(size);
        String kind = matcher.find() ? SERVING_WORDS.get(matcher.group(2)) : null;
        if (kind == null) {
            return quantity == PER_HUNDRED_AMOUNT ? Optional.empty()
                    : Optional.of(new PlannedMeasure(SERVING, quantity, false));
        }
        double count = matcher.group(1) == null ? 1 : Double.parseDouble(matcher.group(1));
        if (count <= 0) {
            return Optional.empty();
        }
        if (SLICE.equals(kind) && facts.categories().contains(BREAD_CATEGORY)) {
            kind = BREAD_SLICE;
        }
        return Optional.of(new PlannedMeasure(kind, quantity / count, false));
    }

    private static String servingUnit(String declaredUnit, String size) {
        if (!declaredUnit.isEmpty()) {
            return declaredUnit;
        }
        Matcher matcher = SERVING_UNIT.matcher(size);
        return matcher.find() ? matcher.group(1) : "";
    }

    private static void add(Map<String, Double> amounts, String kind, double amount, Double packageAmount) {
        double rounded = round(amount);
        boolean fits = rounded >= MIN_BASE_AMOUNT && rounded <= MAX_BASE_AMOUNTS.getOrDefault(kind, MAX_BASE_AMOUNT)
                && (packageAmount == null || rounded < packageAmount);
        if (fits && !amounts.containsKey(kind) && !amounts.containsValue(rounded)) {
            amounts.put(kind, rounded);
        }
    }

    private static int kindOrder(String kind) {
        int index = KIND_ORDER.indexOf(kind);
        return index < 0 ? KIND_ORDER.size() : index;
    }

    private static double round(double amount) {
        return Math.round(amount * 10) / 10.0;
    }

    private static List<String> lines(String file) {
        try (InputStream input = Objects.requireNonNull(OffMeasures.class.getResourceAsStream("/off/" + file),
                "Missing measure list " + file)) {
            return new String(input.readAllBytes(), StandardCharsets.UTF_8).lines()
                    .map(String::trim)
                    .filter(line -> !line.isEmpty())
                    .toList();
        } catch (IOException exception) {
            throw new UncheckedIOException(exception);
        }
    }
}
