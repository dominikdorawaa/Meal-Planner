package com.example.demo.controller;

import com.example.demo.entity.*;
import com.example.demo.repository.ShoppingListRecipeRepository;
import com.example.demo.repository.ShoppingListRepository;
import com.example.demo.repository.UserRepository;
import jakarta.transaction.Transactional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/shopping-list")
public class ShoppingListController {

    @Autowired
    private ShoppingListRepository shoppingListRepository;

    @Autowired
    private ShoppingListRecipeRepository shoppingListRecipeRepository;

    @Autowired
    private UserRepository userRepository;

    private ResponseEntity<?> unauthorized() {
        return ResponseEntity.status(401).body(Map.of("error", "Brak autoryzacji"));
    }

    private User getUser(Authentication authentication) {
        return userRepository.findByEmail(authentication.getName())
                .orElseThrow(() -> new RuntimeException("User not found"));
    }

    @GetMapping
    public ResponseEntity<?> getMyShoppingList(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) return unauthorized();
        User user = getUser(authentication);
        return ResponseEntity.ok(shoppingListRepository.findByUserOrderByIsCheckedAscIngredientNameAsc(user));
    }

    @GetMapping("/recipes")
    public ResponseEntity<?> getMyShoppingListRecipes(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) return unauthorized();
        User user = getUser(authentication);
        return ResponseEntity.ok(shoppingListRecipeRepository.findByUser(user));
    }

    @PostMapping
    public ResponseEntity<?> addTask(@RequestBody ShoppingListItem item, Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) return unauthorized();
        User user = getUser(authentication);
        item.setUser(user);
        return ResponseEntity.ok(shoppingListRepository.save(item));
    }

    @PostMapping("/recipes")
    public ResponseEntity<?> addRecipeToList(@RequestBody ShoppingListRecipe recipe, Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) return unauthorized();
        User user = getUser(authentication);
        recipe.setUser(user);
        return ResponseEntity.ok(shoppingListRecipeRepository.save(recipe));
    }

    @PatchMapping("/{id}")
    public ResponseEntity<ShoppingListItem> toggleItem(@PathVariable UUID id, @RequestBody ShoppingListItem partialUpdate) {
        return shoppingListRepository.findById(id).map(item -> {
            if (partialUpdate.getIsChecked() != null) {
                item.setIsChecked(partialUpdate.getIsChecked());
            }
            return ResponseEntity.ok(shoppingListRepository.save(item));
        }).orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteItem(@PathVariable UUID id) {
        if (shoppingListRepository.existsById(id)) {
            shoppingListRepository.deleteById(id);
            return ResponseEntity.ok().build();
        }
        return ResponseEntity.notFound().build();
    }

    @Transactional
    @DeleteMapping("/clear")
    public ResponseEntity<?> clearAll(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) return unauthorized();
        User user = getUser(authentication);
        shoppingListRepository.deleteByUser(user);
        shoppingListRecipeRepository.deleteByUser(user);
        return ResponseEntity.ok().build();
    }
}
