package com.mealplanner.server.meal;

import com.mealplanner.server.product.Product;
import com.mealplanner.server.product.ProductRepository;
import com.mealplanner.server.recipe.Recipe;
import com.mealplanner.server.recipe.RecipeRepository;
import com.mealplanner.server.user.User;
import com.mealplanner.server.user.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationCredentialsNotFoundException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/meals")
public class MealController {

    @Autowired
    private UserMealRepository userMealRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private RecipeRepository recipeRepository;

    private ResponseEntity<?> unauthorized() {
        throw new AuthenticationCredentialsNotFoundException("Authentication required");
    }

    @GetMapping
    public ResponseEntity<?> getMyMeals(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated())
            return unauthorized();
        String email = authentication.getName();
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new UsernameNotFoundException("User not found"));
        return ResponseEntity.ok(userMealRepository.findByUser(user));
    }

    @GetMapping("/day/{dateStr}")
    public ResponseEntity<?> getMealsForDay(@PathVariable String dateStr, Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated())
            return unauthorized();
        String email = authentication.getName();
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new UsernameNotFoundException("User not found"));
        return ResponseEntity.ok(userMealRepository.findByUserAndDateStr(user, dateStr));
    }

    @PostMapping
    public ResponseEntity<?> addMeal(@RequestBody UserMeal meal, Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated())
            return unauthorized();
        String email = authentication.getName();
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new UsernameNotFoundException("User not found"));
        meal.setUser(user);

        // Resolve product from DB to avoid detached entity issues
        if (meal.getProduct() != null && meal.getProduct().getId() != null) {
            Product product = productRepository.findById(meal.getProduct().getId()).orElse(null);
            meal.setProduct(product);
        }

        // Resolve recipe from DB to avoid detached entity issues
        if (meal.getRecipe() != null && meal.getRecipe().getId() != null) {
            Recipe recipe = recipeRepository.findById(meal.getRecipe().getId()).orElse(null);
            meal.setRecipe(recipe);
        }

        return ResponseEntity.ok(userMealRepository.save(meal));
    }

    @PutMapping("/{id}")
    public ResponseEntity<UserMeal> updateMeal(@PathVariable UUID id, @RequestBody UserMeal mealDetails) {
        return userMealRepository.findById(id).map(meal -> {
            meal.setManualName(mealDetails.getManualName());
            meal.setManualKcal(mealDetails.getManualKcal());
            meal.setManualProtein(mealDetails.getManualProtein());
            meal.setManualFat(mealDetails.getManualFat());
            meal.setManualCarbs(mealDetails.getManualCarbs());
            meal.setPortionsConsumed(mealDetails.getPortionsConsumed());
            return ResponseEntity.ok(userMealRepository.save(meal));
        }).orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteMeal(@PathVariable UUID id) {
        if (userMealRepository.existsById(id)) {
            userMealRepository.deleteById(id);
            return ResponseEntity.ok().build();
        }
        return ResponseEntity.notFound().build();
    }
}
