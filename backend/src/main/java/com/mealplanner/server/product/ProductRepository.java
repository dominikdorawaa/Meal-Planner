package com.mealplanner.server.product;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ProductRepository extends JpaRepository<Product, UUID> {

    String VISIBLE_PRODUCTS = """
            p.deleted_at IS NULL
            AND (p.status = 'VERIFIED' OR (p.status = 'PENDING' AND p.created_by = CAST(:userId AS uuid)))
            AND (CAST(:maxKcal AS double precision) IS NULL OR p.kcal <= CAST(:maxKcal AS double precision))
            AND (CAST(:minProtein AS double precision) IS NULL OR p.protein >= CAST(:minProtein AS double precision))
            AND (CAST(:maxFat AS double precision) IS NULL OR p.fat <= CAST(:maxFat AS double precision))
            AND (CAST(:maxCarbs AS double precision) IS NULL OR p.carbs <= CAST(:maxCarbs AS double precision))
            """;

    String DUPLICATE_COLUMNS = "lower(p.name), lower(coalesce(p.brand, '')), p.kcal, p.protein, p.fat, p.carbs";

    String DUPLICATE_KEY = "(" + DUPLICATE_COLUMNS + ")";

    String RANKED_PRODUCTS = "SELECT p.*, row_number() OVER (PARTITION BY "
            + "CASE WHEN p.source = 'OPEN_FOOD_FACTS' THEN NULL ELSE p.id END, " + DUPLICATE_COLUMNS
            + " ORDER BY EXISTS (SELECT 1 FROM product_measures m WHERE m.product_id = p.id AND m.kind_code = 'package')"
            + " DESC, p.created_at, p.id) AS duplicate_rank FROM products p WHERE ";

    String FIRST_OF_DUPLICATES = ") p WHERE p.duplicate_rank = 1 ";

    Optional<Product> findByBarCodeAndStatusAndDeletedAtIsNull(String barCode, ProductStatus status);

    Optional<Product> findFirstByBarCodeAndStatusAndCreatedByAndDeletedAtIsNullOrderByCreatedAtDesc(
            String barCode, ProductStatus status, UUID createdBy);

    boolean existsByBarCodeAndCreatedByAndIdNotAndDeletedAtIsNull(String barCode, UUID createdBy, UUID id);

    List<Product> findByCreatedByAndDeletedAtIsNullOrderByCreatedAtDesc(UUID createdBy);

    List<Product> findByBarCodeInAndStatus(Collection<String> barCodes, ProductStatus status);

    String CONTAINS_EVERY_WORD =
            "p.search_text LIKE ALL (SELECT CONCAT('%', word, '%') FROM unnest(string_to_array(:query, ' ')) AS word)";

    String EXACT_MATCH = " AND ((p.search_text LIKE CONCAT('%', :keyword, '%') AND " + CONTAINS_EVERY_WORD + ")"
            + " OR p.bar_code = :rawQuery) ";

    String SIMILAR_MATCH = " AND :query <% p.search_text AND NOT (" + CONTAINS_EVERY_WORD + ")"
            + " AND p.bar_code IS DISTINCT FROM :rawQuery ";

    @Query(nativeQuery = true, value = "SELECT p.* FROM (" + RANKED_PRODUCTS + VISIBLE_PRODUCTS + EXACT_MATCH
            + FIRST_OF_DUPLICATES + """
            ORDER BY (p.bar_code = :rawQuery) IS TRUE DESC,
                     (p.search_text LIKE CONCAT(:query, '%')) DESC,
                     (p.source = 'BASIC') DESC,
                     word_similarity(:query, p.search_text) DESC,
                     p.name, p.id
            LIMIT :limit OFFSET :offset
            """)
    List<Product> searchExact(@Param("query") String query, @Param("keyword") String keyword,
                              @Param("rawQuery") String rawQuery,
                              @Param("userId") String userId,
                              @Param("maxKcal") Double maxKcal, @Param("minProtein") Double minProtein,
                              @Param("maxFat") Double maxFat, @Param("maxCarbs") Double maxCarbs,
                              @Param("limit") int limit, @Param("offset") long offset);

    @Query(nativeQuery = true, value = "SELECT COUNT(*) FROM (" + RANKED_PRODUCTS + VISIBLE_PRODUCTS + EXACT_MATCH
            + FIRST_OF_DUPLICATES)
    long countExact(@Param("query") String query, @Param("keyword") String keyword,
                    @Param("rawQuery") String rawQuery,
                    @Param("userId") String userId,
                    @Param("maxKcal") Double maxKcal, @Param("minProtein") Double minProtein,
                    @Param("maxFat") Double maxFat, @Param("maxCarbs") Double maxCarbs);

    @Query(nativeQuery = true, value = "SELECT p.* FROM (" + RANKED_PRODUCTS + VISIBLE_PRODUCTS + SIMILAR_MATCH
            + FIRST_OF_DUPLICATES + """
            ORDER BY (p.source = 'BASIC') DESC, word_similarity(:query, p.search_text) DESC, p.name, p.id
            LIMIT :limit OFFSET :offset
            """)
    List<Product> searchSimilar(@Param("query") String query, @Param("rawQuery") String rawQuery,
                                @Param("userId") String userId,
                                @Param("maxKcal") Double maxKcal, @Param("minProtein") Double minProtein,
                                @Param("maxFat") Double maxFat, @Param("maxCarbs") Double maxCarbs,
                                @Param("limit") int limit, @Param("offset") long offset);

    @Query(nativeQuery = true, value = "SELECT p.* FROM (" + RANKED_PRODUCTS + VISIBLE_PRODUCTS + FIRST_OF_DUPLICATES + """
            ORDER BY p.name, p.id
            LIMIT :limit OFFSET :offset
            """)
    List<Product> listVisible(@Param("userId") String userId,
                              @Param("maxKcal") Double maxKcal, @Param("minProtein") Double minProtein,
                              @Param("maxFat") Double maxFat, @Param("maxCarbs") Double maxCarbs,
                              @Param("limit") int limit, @Param("offset") long offset);
}
