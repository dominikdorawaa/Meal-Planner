package com.mealplanner.server.product;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ProductRepository extends JpaRepository<Product, UUID> {
    Optional<Product> findByBarCodeAndStatusAndDeletedAtIsNull(String barCode, ProductStatus status);

    List<Product> findByDeletedAtIsNull();
}
