package com.mealplanner.server.recipe;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface RecipeRepository extends JpaRepository<Recipe, UUID> {

    @Query("""
            select r from Recipe r
            where r.isArchived = false
              and (r.createdBy = :userId or r.visibility = :publicVisibility)
            order by lower(r.name)
            """)
    List<Recipe> findVisible(@Param("userId") UUID userId,
                             @Param("publicVisibility") RecipeVisibility publicVisibility);
}
