package com.mealplanner.server.product;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface SavedProductRepository extends JpaRepository<SavedProduct, UUID> {

    boolean existsByUserIdAndProductId(UUID userId, UUID productId);

    @Query("SELECT s.product FROM SavedProduct s WHERE s.userId = :userId AND s.product.deletedAt IS NULL "
            + "ORDER BY s.createdAt DESC, s.id")
    List<Product> findSavedProducts(@Param("userId") UUID userId);

    @Modifying
    @Query("DELETE FROM SavedProduct s WHERE s.userId = :userId AND s.product.id = :productId")
    void deleteByUserIdAndProductId(@Param("userId") UUID userId, @Param("productId") UUID productId);
}
