package com.calendories.server.recipe;

import com.calendories.server.database.Collations;
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
            """ + "order by collate(r.name as " + Collations.POLISH_NAMES + "), r.id")
    List<Recipe> findVisible(@Param("userId") UUID userId,
                             @Param("publicVisibility") RecipeVisibility publicVisibility);
}
