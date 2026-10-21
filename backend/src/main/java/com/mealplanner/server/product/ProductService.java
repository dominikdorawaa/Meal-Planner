package com.mealplanner.server.product;

import com.mealplanner.server.handler.ApiException;
import com.mealplanner.server.meal.UserMealRepository;
import com.mealplanner.server.user.User;
import com.mealplanner.server.user.UserRepository;
import com.mealplanner.server.user.UserRole;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ProductService {

    static final int MIN_PAGE_SIZE = 1;
    static final int MAX_PAGE_SIZE = 50;
    static final String BAR_CODE_EXISTS = "product.bar-code-exists";
    static final String MEASURE_INVALID = "product.measure-invalid";
    static final String NOT_FOUND = "error.not-found";
    static final String FORBIDDEN = "error.forbidden";

    private final ProductRepository productRepository;
    private final UserRepository userRepository;
    private final UserMealRepository userMealRepository;
    private final SavedProductRepository savedProductRepository;
    private final MeasureKindRepository measureKindRepository;

    public Product create(Product product, String email) {
        User author = findUser(email);
        validate(product);
        if (product.getBarCode() != null && findByBarCode(product.getBarCode(), author).isPresent()) {
            throw new ApiException(HttpStatus.CONFLICT, BAR_CODE_EXISTS);
        }
        product.setId(null);
        product.setDeletedAt(null);
        product.setSource(ProductSource.USER);
        product.setCreatedBy(author.getId());
        product.setStatus(author.getRole() == UserRole.ADMIN ? ProductStatus.VERIFIED : ProductStatus.PENDING);
        product.setStoredMeasures(new ArrayList<>());
        applyMeasures(product, product.getRequestedMeasures());
        return productRepository.save(product);
    }

    @Transactional
    public Product createOwnVersion(UUID id, Product changes, String email) {
        User author = findUser(email);
        Product original = findActive(id);
        if (!isVisible(original, author)) {
            throw new ApiException(HttpStatus.NOT_FOUND, NOT_FOUND);
        }
        Product copy = new Product();
        copyEditableFields(changes == null ? original : changes, copy);
        boolean inheritedBarCode = copy.getBarCode() != null && copy.getBarCode().equals(original.getBarCode());
        if (inheritedBarCode) {
            copy.setBarCode(null);
        }
        validate(copy);
        if (inheritedBarCode) {
            copy.setBarCode(original.getBarCode());
        }
        if (copy.getBarCode() != null && productRepository.existsByBarCodeAndCreatedByAndIdNotAndDeletedAtIsNull(
                copy.getBarCode(), author.getId(), original.getId())) {
            throw new ApiException(HttpStatus.CONFLICT, BAR_CODE_EXISTS);
        }
        copy.setSource(ProductSource.USER);
        copy.setStatus(ProductStatus.PENDING);
        copy.setCreatedBy(author.getId());
        boolean newMeasures = changes != null && changes.getRequestedMeasures() != null;
        applyMeasures(copy, newMeasures ? changes.getRequestedMeasures() : original.getMeasures());
        Product saved = productRepository.save(copy);
        savedProductRepository.deleteByUserIdAndProductId(author.getId(), original.getId());
        return saved;
    }

    @Transactional
    public Product update(UUID id, Product changes, String email) {
        User user = findUser(email);
        Product product = findActive(id);
        if (!canModify(product, user)) {
            throw new ApiException(HttpStatus.FORBIDDEN, FORBIDDEN);
        }
        String barCode = changes.getBarCode();
        if (barCode != null && !barCode.equals(product.getBarCode()) && findByBarCode(barCode, user)
                .filter(found -> !found.getId().equals(product.getId()))
                .isPresent()) {
            throw new ApiException(HttpStatus.CONFLICT, BAR_CODE_EXISTS);
        }
        copyEditableFields(changes, product);
        validate(product);
        applyMeasures(product, changes.getRequestedMeasures());
        return productRepository.save(product);
    }

    public Optional<Product> findVisible(UUID id, String email) {
        User user = email == null ? null : userRepository.findByEmail(email).orElse(null);
        return productRepository.findById(id).filter(product -> product.getStatus() == ProductStatus.VERIFIED
                || (user != null && (user.getRole() == UserRole.ADMIN || user.getId().equals(product.getCreatedBy()))));
    }

    public List<Product> savedProducts(String email) {
        return savedProductRepository.findSavedProducts(findUser(email).getId());
    }

    public List<Product> ownProducts(String email) {
        return productRepository.findByCreatedByAndDeletedAtIsNullOrderByCreatedAtDesc(findUser(email).getId());
    }

    @Transactional
    public void save(UUID id, String email) {
        User user = findUser(email);
        Product product = findActive(id);
        if (!isVisible(product, user)) {
            throw new ApiException(HttpStatus.NOT_FOUND, NOT_FOUND);
        }
        if (!savedProductRepository.existsByUserIdAndProductId(user.getId(), product.getId())) {
            savedProductRepository.save(new SavedProduct(user.getId(), product));
        }
    }

    @Transactional
    public void unsave(UUID id, String email) {
        savedProductRepository.deleteByUserIdAndProductId(findUser(email).getId(), id);
    }

    public Optional<Product> findByBarCode(String barCode, String email) {
        User user = email == null ? null : userRepository.findByEmail(email).orElse(null);
        return findByBarCode(barCode, user);
    }

    private Optional<Product> findByBarCode(String barCode, User user) {
        if (user != null) {
            Optional<Product> own = productRepository
                    .findFirstByBarCodeAndStatusAndCreatedByAndDeletedAtIsNullOrderByCreatedAtDesc(
                            barCode, ProductStatus.PENDING, user.getId());
            if (own.isPresent()) {
                return own;
            }
        }
        return productRepository.findByBarCodeAndStatusAndDeletedAtIsNull(barCode, ProductStatus.VERIFIED);
    }

    @Transactional
    public void delete(UUID id, String email) {
        User user = findUser(email);
        Product product = findActive(id);

        if (!canModify(product, user)) {
            throw new ApiException(HttpStatus.FORBIDDEN, FORBIDDEN);
        }

        if (userMealRepository.existsByProduct(product)) {
            product.setDeletedAt(OffsetDateTime.now());
            productRepository.save(product);
        } else {
            productRepository.delete(product);
        }
    }

    public ProductPage search(String query, ProductFilters filters, int page, int size, String email) {
        int pageSize = Math.clamp(size, MIN_PAGE_SIZE, MAX_PAGE_SIZE);
        int pageNumber = Math.max(page, 0);
        String userId = email == null ? null : userRepository.findByEmail(email)
                .map(user -> user.getId().toString())
                .orElse(null);
        String normalizedQuery = ProductSearchText.normalize(query);
        int limit = pageSize + 1;
        long offset = (long) pageNumber * pageSize;

        List<Product> found = normalizedQuery.isEmpty()
                ? productRepository.listVisible(userId, filters.maxKcal(), filters.minProtein(),
                        filters.maxFat(), filters.maxCarbs(), limit, offset)
                : searchByText(normalizedQuery, query.trim(), userId, filters, limit, offset);

        boolean hasNext = found.size() > pageSize;
        List<Product> items = hasNext ? found.subList(0, pageSize) : found;
        return new ProductPage(items, pageNumber, pageSize, hasNext);
    }

    private List<Product> searchByText(String query, String rawQuery, String userId, ProductFilters filters,
                                       int limit, long offset) {
        String keyword = Arrays.stream(query.split(" "))
                .max(Comparator.comparingInt(String::length))
                .orElse(query);
        List<Product> exact = productRepository.searchExact(query, keyword, rawQuery, userId, filters.maxKcal(),
                filters.minProtein(), filters.maxFat(), filters.maxCarbs(), limit, offset);
        if (exact.size() == limit) {
            return exact;
        }

        long exactTotal = exact.isEmpty() && offset > 0
                ? productRepository.countExact(query, keyword, rawQuery, userId, filters.maxKcal(),
                        filters.minProtein(), filters.maxFat(), filters.maxCarbs())
                : offset + exact.size();
        long similarOffset = Math.max(0, offset - exactTotal);
        List<Product> similar = productRepository.searchSimilar(query, rawQuery, userId, filters.maxKcal(),
                filters.minProtein(), filters.maxFat(), filters.maxCarbs(), limit - exact.size(), similarOffset);

        List<Product> combined = new ArrayList<>(exact);
        combined.addAll(similar);
        return combined;
    }

    private boolean canModify(Product product, User user) {
        if (user.getRole() == UserRole.ADMIN) {
            return true;
        }
        return product.getStatus() == ProductStatus.PENDING && user.getId().equals(product.getCreatedBy());
    }

    private boolean isVisible(Product product, User user) {
        return product.getStatus() == ProductStatus.VERIFIED
                || (product.getStatus() == ProductStatus.PENDING && user.getId().equals(product.getCreatedBy()));
    }

    private Product findActive(UUID id) {
        return productRepository.findById(id)
                .filter(found -> found.getDeletedAt() == null)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, NOT_FOUND));
    }

    private void validate(Product product) {
        NutritionCheck check = NutritionValidator.check(product);
        if (!check.isValid()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, check.errors().getFirst().messageKey());
        }
    }

    private void applyMeasures(Product product, List<Measure> requested) {
        if (requested == null) {
            return;
        }
        String baseCode = ProductMeasures.baseCode(product.getUnit());
        if (requested.stream().anyMatch(measure -> measure == null || measure.code() == null)
                || requested.stream().filter(measure -> measure.defaultMeasure()).count() > 1
                || requested.stream().map(Measure::code).distinct().count() < requested.size()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, MEASURE_INVALID);
        }
        List<Measure> extra = ProductMeasures.perPiece(product.getUnit()) ? List.of()
                : requested.stream().filter(measure -> !baseCode.equals(measure.code())).toList();
        List<String> codes = extra.stream().map(Measure::code).toList();
        product.getStoredMeasures().removeIf(stored -> !codes.contains(stored.getKind().getCode()));
        for (int position = 0; position < extra.size(); position++) {
            Measure measure = extra.get(position);
            MeasureKind kind = measureKindRepository.findById(measure.code())
                    .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, MEASURE_INVALID));
            Double amount = measure.baseAmount();
            double rounded = amount == null || !Double.isFinite(amount) ? 0 : Math.round(amount * 10) / 10.0;
            if (rounded <= 0 || rounded > kind.getMaxBaseAmount()) {
                throw new ApiException(HttpStatus.BAD_REQUEST, MEASURE_INVALID);
            }
            ProductMeasure stored = product.getStoredMeasures().stream()
                    .filter(existing -> existing.getKind().getCode().equals(kind.getCode()))
                    .findFirst()
                    .orElseGet(() -> {
                        ProductMeasure created = new ProductMeasure(product, kind);
                        product.getStoredMeasures().add(created);
                        return created;
                    });
            stored.setBaseAmount(rounded);
            stored.setDefaultMeasure(measure.defaultMeasure());
            stored.setPosition(position);
        }
    }

    private static void copyEditableFields(Product source, Product target) {
        target.setName(source.getName());
        target.setBrand(source.getBrand());
        target.setKcal(source.getKcal());
        target.setProtein(source.getProtein());
        target.setFat(source.getFat());
        target.setCarbs(source.getCarbs());
        target.setSaturatedFat(source.getSaturatedFat());
        target.setSugars(source.getSugars());
        target.setFiber(source.getFiber());
        target.setSalt(source.getSalt());
        target.setUnit(source.getUnit());
        target.setBarCode(source.getBarCode());
    }

    private User findUser(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "error.unauthorized"));
    }
}
