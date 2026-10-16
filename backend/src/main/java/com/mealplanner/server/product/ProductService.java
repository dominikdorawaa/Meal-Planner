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
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ProductService {

    private final ProductRepository productRepository;
    private final UserRepository userRepository;
    private final UserMealRepository userMealRepository;

    public Product create(Product product, String email) {
        User author = findUser(email);
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
