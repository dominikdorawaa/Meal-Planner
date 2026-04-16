package com.example.demo.controller;

import com.example.demo.entity.User;
import com.example.demo.entity.UserMeal;
import com.example.demo.repository.UserMealRepository;
import com.example.demo.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/meals")
public class MealController {

    @Autowired
    private UserMealRepository userMealRepository;

    @Autowired
    private UserRepository userRepository;

    private ResponseEntity<?> unauthorized() {
        return ResponseEntity.status(401).body(Map.of("error", "Brak autoryzacji"));
    }

    @GetMapping
    public ResponseEntity<?> getMyMeals(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) return unauthorized();
        String email = authentication.getName();
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));
        return ResponseEntity.ok(userMealRepository.findByUser(user));
    }

    @GetMapping("/day/{dateStr}")
    public ResponseEntity<?> getMealsForDay(@PathVariable String dateStr, Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) return unauthorized();
        String email = authentication.getName();
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));
        return ResponseEntity.ok(userMealRepository.findByUserAndDateStr(user, dateStr));
    }

    @PostMapping
    public ResponseEntity<?> addMeal(@RequestBody UserMeal meal, Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) return unauthorized();
        String email = authentication.getName();
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));
        meal.setUser(user);
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
