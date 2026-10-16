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

    Optional<Product> findByBarCodeAndStatusAndDeletedAtIsNull(String barCode, ProductStatus status);

    List<Product> findByBarCodeInAndStatusAndDeletedAtIsNull(Collection<String> barCodes, ProductStatus status);

    String CONTAINS_EVERY_WORD =
            "p.search_text LIKE ALL (SELECT CONCAT('%', word, '%') FROM unnest(string_to_array(:query, ' ')) AS word)";

    String EXACT_MATCH = " AND ((p.search_text LIKE CONCAT('%', :keyword, '%') AND " + CONTAINS_EVERY_WORD + ")"
            + " OR p.bar_code = :rawQuery) ";

    String SIMILAR_MATCH = " AND :query <% p.search_text AND NOT (" + CONTAINS_EVERY_WORD + ")"
            + " AND p.bar_code IS DISTINCT FROM :rawQuery ";

    @Query(nativeQuery = true, value = "SELECT p.* FROM products p WHERE " + VISIBLE_PRODUCTS + EXACT_MATCH + """
            ORDER BY (p.bar_code = :rawQuery) DESC NULLS LAST,
                     (p.search_text LIKE CONCAT(:query, '%')) DESC,
                     word_similarity(:query, p.search_text) DESC,
                     p.name, p.id
            LIMIT :limit OFFSET :offset
            """)
    List<Product> searchExact(@Param("query") String query, @Param("keyword") String keyword,
                              @Param("rawQuery") String rawQuery,
                              @Param("userId") String userId,
                              @Param("maxKcal") Double maxKcal, @Param("minProtein") Double minProtein,
                              @Param("maxFat") Double maxFat, @Param("maxCarbs") Double maxCarbs,
                              @Param("limit") int limit, @Param("offset") int offset);

    @Query(nativeQuery = true, value = "SELECT COUNT(*) FROM products p WHERE " + VISIBLE_PRODUCTS + EXACT_MATCH)
    long countExact(@Param("query") String query, @Param("keyword") String keyword,
                    @Param("rawQuery") String rawQuery,
                    @Param("userId") String userId,
                    @Param("maxKcal") Double maxKcal, @Param("minProtein") Double minProtein,
                    @Param("maxFat") Double maxFat, @Param("maxCarbs") Double maxCarbs);

    @Query(nativeQuery = true, value = "SELECT p.* FROM products p WHERE " + VISIBLE_PRODUCTS + SIMILAR_MATCH + """
            ORDER BY word_similarity(:query, p.search_text) DESC, p.name, p.id
            LIMIT :limit OFFSET :offset
            """)
    List<Product> searchSimilar(@Param("query") String query, @Param("rawQuery") String rawQuery,
                                @Param("userId") String userId,
                                @Param("maxKcal") Double maxKcal, @Param("minProtein") Double minProtein,
                                @Param("maxFat") Double maxFat, @Param("maxCarbs") Double maxCarbs,
                                @Param("limit") int limit, @Param("offset") int offset);

    @Query(nativeQuery = true, value = "SELECT p.* FROM products p WHERE " + VISIBLE_PRODUCTS + """
            ORDER BY p.name, p.id
            LIMIT :limit OFFSET :offset
            """)
    List<Product> listVisible(@Param("userId") String userId,
                              @Param("maxKcal") Double maxKcal, @Param("minProtein") Double minProtein,
                              @Param("maxFat") Double maxFat, @Param("maxCarbs") Double maxCarbs,
                              @Param("limit") int limit, @Param("offset") int offset);
}
