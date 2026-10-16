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
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ProductService {

    static final int MIN_PAGE_SIZE = 1;
    static final int MAX_PAGE_SIZE = 50;

    private final ProductRepository productRepository;
    private final UserRepository userRepository;
    private final UserMealRepository userMealRepository;

    public Product create(Product product, String email) {
        User author = findUser(email);
        NutritionCheck check = NutritionValidator.check(product);
        if (!check.isValid()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, check.errors().getFirst().messageKey());
        }
        product.setId(null);
        product.setDeletedAt(null);
        product.setSource(ProductSource.USER);
        product.setCreatedBy(author.getId());
        product.setStatus(author.getRole() == UserRole.ADMIN ? ProductStatus.VERIFIED : ProductStatus.PENDING);
        return productRepository.save(product);
    }

    @Transactional
    public void delete(UUID id, String email) {
        User user = findUser(email);
        Product product = productRepository.findById(id)
                .filter(found -> found.getDeletedAt() == null)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "error.not-found"));

        if (!canDelete(product, user)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "error.forbidden");
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

    private boolean canDelete(Product product, User user) {
        if (user.getRole() == UserRole.ADMIN) {
            return true;
        }
        return product.getStatus() == ProductStatus.PENDING && user.getId().equals(product.getCreatedBy());
    }

    private User findUser(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "error.unauthorized"));
    }
}
