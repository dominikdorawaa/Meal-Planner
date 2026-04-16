package com.example.demo.controller;

import com.example.demo.entity.Recipe;
import com.example.demo.entity.User;
import com.example.demo.repository.UserRepository;
import com.example.demo.repository.RecipeRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/recipes")
public class RecipeController {

    @Autowired
    private RecipeRepository recipeRepository;

    @Autowired
    private UserRepository userRepository;

    @GetMapping
    public List<Recipe> getAllRecipes() {
        return recipeRepository.findByIsArchivedFalse();
    }

    @GetMapping("/{id}")
    public ResponseEntity<Recipe> getRecipeById(@PathVariable UUID id) {
        return recipeRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<?> createRecipe(@RequestBody Recipe recipe, Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return ResponseEntity.status(401).body(Map.of("error", "Brak autoryzacji"));
        }
        String email = authentication.getName();
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));

        recipe.setCreatedBy(user.getId());

        // Link ingredients back to the recipe for JPA to handle cascading
        if (recipe.getIngredients() != null) {
            recipe.getIngredients().forEach(ing -> ing.setRecipe(recipe));
        }

        return ResponseEntity.ok(recipeRepository.save(recipe));
    }

    @PutMapping("/{id}")
    public ResponseEntity<Recipe> updateRecipe(@PathVariable UUID id, @RequestBody Recipe recipeDetails) {
        return recipeRepository.findById(id).map(recipe -> {
            recipe.setName(recipeDetails.getName());
            recipe.setImageUrl(recipeDetails.getImageUrl());
            recipe.setKcal(recipeDetails.getKcal());
            recipe.setProtein(recipeDetails.getProtein());
            recipe.setFat(recipeDetails.getFat());
            recipe.setCarbs(recipeDetails.getCarbs());
            recipe.setPrepTime(recipeDetails.getPrepTime());
            recipe.setPortions(recipeDetails.getPortions());
            recipe.setInstructions(recipeDetails.getInstructions());
            recipe.setIsArchived(recipeDetails.getIsArchived());

            // Clear existing and add new ingredients to avoid orphans
            recipe.getIngredients().clear();
            if (recipeDetails.getIngredients() != null) {
                recipeDetails.getIngredients().forEach(ing -> {
                    ing.setRecipe(recipe);
                    recipe.getIngredients().add(ing);
                });
            }

            return ResponseEntity.ok(recipeRepository.save(recipe));
        }).orElse(ResponseEntity.notFound().build());
    }

    @PatchMapping("/{id}/archive")
    public ResponseEntity<Recipe> archiveRecipe(@PathVariable UUID id) {
        return recipeRepository.findById(id).map(recipe -> {
            recipe.setIsArchived(true);
            return ResponseEntity.ok(recipeRepository.save(recipe));
        }).orElse(ResponseEntity.notFound().build());
    }
}
