package com.mealplanner.server.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class RegisterRequest {
    @Email(message = "{validation.email.invalid}")
    @NotBlank(message = "{validation.email.required}")
    private String email;

    @NotBlank(message = "{validation.name.required}")
    private String name;

    @NotBlank(message = "{validation.password.required}")
    @Size(min = 6, message = "{validation.password.too-short}")
    private String password;
}
