package com.mealplanner.server.recipe;

import com.mealplanner.server.handler.ApiException;
import com.mealplanner.server.product.ProductRepository;
import com.mealplanner.server.user.User;
import com.mealplanner.server.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationCredentialsNotFoundException;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class RecipeService {

    static final String NOT_FOUND = "error.not-found";
    static final String FORBIDDEN = "error.forbidden";

    private final RecipeRepository recipeRepository;
    private final SavedRecipeRepository savedRecipeRepository;
    private final UserRepository userRepository;
    private final ProductRepository productRepository;

    @Transactional(readOnly = true)
    public List<Recipe> findVisible(String email) {
        UUID userId = optionalUserId(email);
        return describe(recipeRepository.findVisible(userId, RecipeVisibility.PUBLIC), userId);
    }

    @Transactional(readOnly = true)
    public List<Recipe> findSaved(String email) {
        UUID userId = requireUser(email).getId();
        return describe(savedRecipeRepository.findVisibleSavedRecipes(userId, RecipeVisibility.PUBLIC), userId);
    }

    @Transactional(readOnly = true)
    public Recipe findById(UUID id, String email) {
        UUID userId = optionalUserId(email);
        Recipe recipe = recipeRepository.findById(id)
                .filter(found -> isOwnedBy(found, userId) || isAvailableToOthers(found))
                .orElseThrow(RecipeService::notFound);
        return describe(recipe, userId, savedRecipeIds(userId));
    }

    @Transactional
    public Recipe create(Recipe recipe, String email) {
        UUID userId = requireUser(email).getId();
        recipe.setId(null);
        recipe.setCreatedBy(userId);
        recipe.setVisibility(RecipeVisibility.PRIVATE);
        recipe.setIsArchived(false);
        if (recipe.getIngredients() == null) {
            recipe.setIngredients(new ArrayList<>());
        }
        recipe.getIngredients().forEach(ingredient -> linkIngredient(recipe, ingredient));
        return describe(recipeRepository.save(recipe), userId, savedRecipeIds(userId));
    }

    @Transactional
    public Recipe update(UUID id, Recipe details, String email) {
        UUID userId = requireUser(email).getId();
        Recipe recipe = findEditable(id, userId);
        recipe.setName(details.getName());
        recipe.setImageUrl(details.getImageUrl());
        recipe.copyStoredNutrition(details);
        recipe.setPrepTime(details.getPrepTime());
        recipe.setPortions(details.getPortions());
        recipe.setInstructions(details.getInstructions());
        if (recipe.getIngredients() == null) {
            recipe.setIngredients(new ArrayList<>());
        }
        recipe.getIngredients().clear();
        if (details.getIngredients() != null) {
            details.getIngredients().forEach(ingredient -> {
                linkIngredient(recipe, ingredient);
                recipe.getIngredients().add(ingredient);
            });
        }
        return describe(recipeRepository.save(recipe), userId, savedRecipeIds(userId));
    }

    @Transactional
    public Recipe setArchived(UUID id, boolean archived, String email) {
        UUID userId = requireUser(email).getId();
        Recipe recipe = findEditable(id, userId);
        recipe.setIsArchived(archived);
        return describe(recipeRepository.save(recipe), userId, savedRecipeIds(userId));
    }

    @Transactional
    public void save(UUID id, String email) {
        UUID userId = requireUser(email).getId();
        Recipe recipe = recipeRepository.findById(id)
                .filter(found -> !found.getIsArchived())
                .filter(found -> isOwnedBy(found, userId) || isAvailableToOthers(found))
                .orElseThrow(RecipeService::notFound);
        if (!savedRecipeRepository.existsByUserIdAndRecipeId(userId, id)) {
            savedRecipeRepository.save(new SavedRecipe(userId, recipe));
        }
    }

    @Transactional
    public void unsave(UUID id, String email) {
        UUID userId = requireUser(email).getId();
        savedRecipeRepository.deleteByUserIdAndRecipeId(userId, id);
    }

    User requireUser(String email) {
        if (email == null) {
            throw new AuthenticationCredentialsNotFoundException("Authentication required");
        }
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new UsernameNotFoundException("User not found"));
    }

    private UUID optionalUserId(String email) {
        if (email == null) {
            return null;
        }
        return userRepository.findByEmail(email).map(User::getId).orElse(null);
    }

    private Recipe findEditable(UUID id, UUID userId) {
        Recipe recipe = recipeRepository.findById(id).orElseThrow(RecipeService::notFound);
        if (isOwnedBy(recipe, userId)) {
            return recipe;
        }
        if (isAvailableToOthers(recipe)) {
            throw new ApiException(HttpStatus.FORBIDDEN, FORBIDDEN);
        }
        throw notFound();
    }

    private static boolean isOwnedBy(Recipe recipe, UUID userId) {
        return userId != null && userId.equals(recipe.getCreatedBy());
    }

    private static boolean isAvailableToOthers(Recipe recipe) {
        return recipe.getVisibility() == RecipeVisibility.PUBLIC && !recipe.getIsArchived();
    }

    private Set<UUID> savedRecipeIds(UUID userId) {
        return userId == null ? Set.of() : savedRecipeRepository.findRecipeIdsByUserId(userId);
    }

    private List<Recipe> describe(List<Recipe> recipes, UUID userId) {
        Set<UUID> savedIds = savedRecipeIds(userId);
        recipes.forEach(recipe -> describe(recipe, userId, savedIds));
        return recipes;
    }

    private static Recipe describe(Recipe recipe, UUID userId, Set<UUID> savedIds) {
        recipe.setOwn(isOwnedBy(recipe, userId));
        recipe.setSaved(savedIds.contains(recipe.getId()));
        return recipe;
    }

    private void linkIngredient(Recipe recipe, RecipeIngredient ingredient) {
        ingredient.setId(null);
        ingredient.setRecipe(recipe);
        if (ingredient.getProduct() != null) {
            ingredient.setProduct(ingredient.getProduct().getId() == null ? null
                    : productRepository.findById(ingredient.getProduct().getId()).orElse(null));
        }
    }

    private static ApiException notFound() {
        return new ApiException(HttpStatus.NOT_FOUND, NOT_FOUND);
    }
}
