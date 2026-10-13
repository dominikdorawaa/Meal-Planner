package com.mealplanner.server.shoppinglist;

import com.mealplanner.server.user.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface ShoppingListRecipeRepository extends JpaRepository<ShoppingListRecipe, UUID> {
    List<ShoppingListRecipe> findByUser(User user);
    void deleteByUser(User user);
}
