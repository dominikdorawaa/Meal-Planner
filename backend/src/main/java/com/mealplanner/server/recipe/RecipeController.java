package com.mealplanner.server.recipe;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/recipes")
@RequiredArgsConstructor
public class RecipeController {

    private final RecipeService recipeService;
    private final RecipeImageService recipeImageService;

    @GetMapping
    public List<Recipe> getRecipes(Authentication authentication) {
        return recipeService.findVisible(email(authentication));
    }

    @GetMapping("/saved")
    public List<Recipe> getSavedRecipes(Authentication authentication) {
        return recipeService.findSaved(email(authentication));
    }

    @GetMapping("/{id}")
    public Recipe getRecipeById(@PathVariable UUID id, Authentication authentication) {
        return recipeService.findById(id, email(authentication));
    }

    @PostMapping
    public Recipe createRecipe(@RequestBody Recipe recipe, Authentication authentication) {
        return recipeService.create(recipe, email(authentication));
    }

    @PutMapping("/{id}")
    public Recipe updateRecipe(@PathVariable UUID id, @RequestBody Recipe recipe, Authentication authentication) {
        return recipeService.update(id, recipe, email(authentication));
    }

    @PatchMapping("/{id}/archive")
    public Recipe archiveRecipe(@PathVariable UUID id, Authentication authentication) {
        return recipeService.setArchived(id, true, email(authentication));
    }

    @PatchMapping("/{id}/restore")
    public Recipe restoreRecipe(@PathVariable UUID id, Authentication authentication) {
        return recipeService.setArchived(id, false, email(authentication));
    }

    @PostMapping("/{id}/saved")
    public ResponseEntity<Void> saveRecipe(@PathVariable UUID id, Authentication authentication) {
        recipeService.save(id, email(authentication));
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{id}/saved")
    public ResponseEntity<Void> unsaveRecipe(@PathVariable UUID id, Authentication authentication) {
        recipeService.unsave(id, email(authentication));
        return ResponseEntity.noContent().build();
    }

    @PostMapping(path = "/images", consumes = "multipart/form-data")
    public Map<String, String> uploadImage(@RequestParam(name = "file", required = false) MultipartFile file,
                                           Authentication authentication) {
        return Map.of("url", recipeImageService.upload(file, email(authentication)));
    }

    private static String email(Authentication authentication) {
        return authentication == null ? null : authentication.getName();
    }
}
