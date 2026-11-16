package com.calendories.server.shoppinglist;

import com.calendories.server.user.User;
import com.calendories.server.user.UserRepository;
import org.springframework.security.authentication.AuthenticationCredentialsNotFoundException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/shopping-list/departments")
public class ShoppingDepartmentController {

    private final ShoppingDepartmentService departmentService;
    private final UserRepository userRepository;

    public ShoppingDepartmentController(ShoppingDepartmentService departmentService, UserRepository userRepository) {
        this.departmentService = departmentService;
        this.userRepository = userRepository;
    }

    private UUID userId(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            throw new AuthenticationCredentialsNotFoundException("Authentication required");
        }
        return userRepository.findByEmail(authentication.getName())
                .map(User::getId)
                .orElseThrow(() -> new UsernameNotFoundException("User not found"));
    }

    @GetMapping
    public ShoppingDepartmentService.Departments list(Authentication authentication) {
        return departmentService.list(userId(authentication));
    }

    @PutMapping("/assignments")
    public ShoppingDepartmentService.Departments assign(@RequestBody ShoppingDepartmentService.AssignRequest request,
            Authentication authentication) {
        return departmentService.assign(userId(authentication), request);
    }

    @DeleteMapping("/{id}")
    public ShoppingDepartmentService.Departments delete(@PathVariable String id, Authentication authentication) {
        return departmentService.delete(userId(authentication), id);
    }
}
