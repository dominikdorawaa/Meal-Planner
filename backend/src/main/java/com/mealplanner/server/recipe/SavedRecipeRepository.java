package com.mealplanner.server.recipe;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Set;
import java.util.UUID;

public interface SavedRecipeRepository extends JpaRepository<SavedRecipe, UUID> {

    boolean existsByUserIdAndRecipeId(UUID userId, UUID recipeId);

    @Query("select s.recipe.id from SavedRecipe s where s.userId = :userId")
    Set<UUID> findRecipeIdsByUserId(@Param("userId") UUID userId);

    @Query("""
            select s.recipe from SavedRecipe s
            where s.userId = :userId
              and s.recipe.isArchived = false
              and (s.recipe.createdBy = :userId or s.recipe.visibility = :publicVisibility)
            order by s.createdAt desc
            """)
    List<Recipe> findVisibleSavedRecipes(@Param("userId") UUID userId,
                                         @Param("publicVisibility") RecipeVisibility publicVisibility);

    @Modifying
    @Query("delete from SavedRecipe s where s.userId = :userId and s.recipe.id = :recipeId")
    void deleteByUserIdAndRecipeId(@Param("userId") UUID userId, @Param("recipeId") UUID recipeId);
}
