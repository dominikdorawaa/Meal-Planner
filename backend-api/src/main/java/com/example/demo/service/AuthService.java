package com.example.demo.service;

import com.example.demo.dto.AuthResponse;
import com.example.demo.dto.LoginRequest;
import com.example.demo.dto.RegisterRequest;
import com.example.demo.entity.User;
import com.example.demo.repository.UserRepository;
import com.example.demo.security.JwtUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;

    public AuthResponse register(RegisterRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new IllegalArgumentException("Użytkownik z tym emailem już istnieje");
        }

        User user = new User();
        user.setEmail(request.getEmail());
        user.setName(request.getName());
        user.setPasswordHash(passwordEncoder.encode(request.getPassword()));

        User saved = userRepository.save(user);

        String token = jwtUtil.generateToken(saved.getId(), saved.getEmail());
        return new AuthResponse(token, saved.getId().toString(), saved.getEmail(), saved.getName());
    }

    public AuthResponse login(LoginRequest request) {
        System.out.println("DEBUG: Attempting login for email: " + request.getEmail());
        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> {
                    System.err.println("DEBUG: User not found: " + request.getEmail());
                    return new IllegalArgumentException("Nieprawidłowy email lub hasło");
                });

        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            System.err.println("DEBUG: Password mismatch for email: " + request.getEmail());
            // System.err.println("DEBUG: Provided: " + request.getPassword());
            // System.err.println("DEBUG: In DB: " + user.getPasswordHash());
            throw new IllegalArgumentException("Nieprawidłowy email lub hasło");
        }
        System.out.println("DEBUG: Login successful for email: " + request.getEmail());

        String token = jwtUtil.generateToken(user.getId(), user.getEmail());
        return new AuthResponse(token, user.getId().toString(), user.getEmail(), user.getName());
    }
}
