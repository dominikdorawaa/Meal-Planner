package com.mealplanner.server.off;

import com.mealplanner.server.product.BarCodes;
import com.mealplanner.server.product.NutritionValidator;
import com.mealplanner.server.product.Product;
import com.mealplanner.server.product.ProductRepository;
import com.mealplanner.server.product.ProductSource;
import com.mealplanner.server.product.ProductStatus;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.Optional;

@Slf4j
@Service
public class OffLookupService {

    static final String UNIT = "100g";
    static final int MAX_TEXT_LENGTH = 255;
    static final int NOT_FOUND_CACHE_SIZE = 10_000;

    private final OffApiClient apiClient;
    private final ProductRepository productRepository;
    private final RequestLimiter limiter;
    private final ExpiringCodeCache notFound;

    public OffLookupService(OffApiClient apiClient, ProductRepository productRepository,
                            @Value("${off.api.requests-per-minute:90}") int requestsPerMinute,
                            @Value("${off.api.not-found-ttl:24h}") Duration notFoundTtl) {
        this.apiClient = apiClient;
        this.productRepository = productRepository;
        this.limiter = new RequestLimiter(requestsPerMinute, Duration.ofMinutes(1), Instant::now);
        this.notFound = new ExpiringCodeCache(notFoundTtl, NOT_FOUND_CACHE_SIZE, Instant::now);
    }

    public OffLookupResult lookup(String barCode) {
        if (!BarCodes.isValid(barCode) || notFound.contains(barCode) || !limiter.tryAcquire()) {
            return OffLookupResult.missing();
        }
        Optional<OffProduct> found;
        try {
            found = apiClient.findProduct(barCode);
        } catch (OffUnavailableException exception) {
            log.warn("Open Food Facts lookup failed for {}", barCode, exception);
            return OffLookupResult.missing();
        }
        if (found.isEmpty()) {
            notFound.add(barCode);
            return OffLookupResult.missing();
        }
        OffProduct offProduct = withCode(found.get(), barCode);
        boolean valid = offProduct.polishName() && NutritionValidator.check(offProduct.name(), offProduct.kcal(),
                offProduct.protein(), offProduct.fat(), offProduct.carbs(), UNIT, barCode).isValid();
        return valid ? OffLookupResult.found(save(offProduct)) : OffLookupResult.incomplete(offProduct);
    }

    private Product save(OffProduct offProduct) {
        Product product = new Product();
        product.setBarCode(offProduct.code());
        product.setName(shorten(offProduct.name()));
        product.setBrand(offProduct.brand().isEmpty() ? null : shorten(offProduct.brand()));
        product.setKcal(offProduct.kcal());
        product.setProtein(offProduct.protein());
        product.setFat(offProduct.fat());
        product.setCarbs(offProduct.carbs());
        offProduct.extras().cleanedFor(offProduct.fat(), offProduct.carbs()).applyTo(product);
        product.setUnit(UNIT);
        product.setStatus(ProductStatus.VERIFIED);
        product.setSource(ProductSource.OPEN_FOOD_FACTS);
        try {
            return productRepository.saveAndFlush(product);
        } catch (DataIntegrityViolationException exception) {
            return productRepository.findByBarCodeAndStatusAndDeletedAtIsNull(offProduct.code(), ProductStatus.VERIFIED)
                    .orElseThrow(() -> exception);
        }
    }

    private static OffProduct withCode(OffProduct product, String barCode) {
        return new OffProduct(barCode, product.name(), product.brand(), product.kcal(), product.protein(),
                product.fat(), product.carbs(), product.extras(), product.quantity(), product.polishName());
    }

    private static String shorten(String text) {
        return text.length() > MAX_TEXT_LENGTH ? text.substring(0, MAX_TEXT_LENGTH) : text;
    }
}
