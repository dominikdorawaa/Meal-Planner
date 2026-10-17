package com.mealplanner.server.auth;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationCredentialsNotFoundException;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/register")
    public ResponseEntity<?> register(@Valid @RequestBody RegisterRequest request) {
        return ResponseEntity.ok(authService.register(request));
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody LoginRequest request) {
        return ResponseEntity.ok(authService.login(request));
    }

    @PostMapping("/refresh")
    public ResponseEntity<?> refresh(org.springframework.security.core.Authentication auth) {
        if (auth == null) {
            throw new AuthenticationCredentialsNotFoundException("Authentication required");
        }
        return ResponseEntity.ok(authService.refresh(auth.getName()));
    }

    @GetMapping("/me")
    public ResponseEntity<?> me(org.springframework.security.core.Authentication auth) {
        if (auth == null) {
            throw new AuthenticationCredentialsNotFoundException("Authentication required");
        }
        // Principal to zazwyczaj ID użytkownika jako String. Jeśli potrzebujemy imienia,
        // musielibyśmy tu wyciągnąć User z bazy. Na razie zwracamy samo ID z rzutowaniem do AuthResponse
        return ResponseEntity.ok(Map.of("userId", auth.getPrincipal()));
    }
}
