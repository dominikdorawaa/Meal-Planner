package com.mealplanner.server.auth;

import com.mealplanner.server.handler.ApiException;
import com.mealplanner.server.user.User;
import com.mealplanner.server.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public AuthResponse register(RegisterRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "auth.email-taken");
        }

        User user = new User();
        user.setEmail(request.getEmail());
        user.setName(request.getName());
        user.setPasswordHash(passwordEncoder.encode(request.getPassword()));

        User saved = userRepository.save(user);

        String token = jwtService.generateToken(saved.getId(), saved.getEmail());
        return new AuthResponse(token, saved.getId().toString(), saved.getEmail(), saved.getName());
    }

    public AuthResponse login(LoginRequest request) {
        System.out.println("DEBUG: Attempting login for email: " + request.getEmail());
        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> {
                    System.err.println("DEBUG: User not found: " + request.getEmail());
                    return new ApiException(HttpStatus.UNAUTHORIZED, "auth.invalid-credentials");
                });

        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            System.err.println("DEBUG: Password mismatch for email: " + request.getEmail());
            // System.err.println("DEBUG: Provided: " + request.getPassword());
            // System.err.println("DEBUG: In DB: " + user.getPasswordHash());
            throw new ApiException(HttpStatus.UNAUTHORIZED, "auth.invalid-credentials");
        }
        System.out.println("DEBUG: Login successful for email: " + request.getEmail());

        String token = jwtService.generateToken(user.getId(), user.getEmail());
        return new AuthResponse(token, user.getId().toString(), user.getEmail(), user.getName());
    }
}
