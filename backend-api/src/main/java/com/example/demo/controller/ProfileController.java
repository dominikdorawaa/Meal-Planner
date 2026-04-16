package com.example.demo.controller;

import com.example.demo.entity.UserProfile;
import com.example.demo.service.ProfileService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/profile")
@RequiredArgsConstructor
public class ProfileController {

    private final ProfileService profileService;

    @GetMapping
    public ResponseEntity<?> getProfile(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return ResponseEntity.status(401).body(Map.of("error", "Brak autoryzacji"));
        }
        String email = authentication.getName();
        return profileService.getProfileByEmail(email)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping
    public ResponseEntity<?> updateProfile(Authentication authentication, @RequestBody UserProfile profile) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return ResponseEntity.status(401).body(Map.of("error", "Brak autoryzacji"));
        }
        String email = authentication.getName();
        try {
            UserProfile saved = profileService.saveProfile(email, profile);
            return ResponseEntity.ok(saved);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(500).body(Map.of("error", e.getMessage(), "trace", e.toString()));
        }
    }
}
