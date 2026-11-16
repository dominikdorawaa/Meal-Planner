package com.calendories.server.shoppinglist;

import com.calendories.server.handler.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class ShoppingDepartmentService {

    static final Set<String> BUILT_IN_DEPARTMENTS = Set.of("produce", "bakery", "meat", "dairy", "grains", "condiments", "other");
    static final int MAX_NAME_LENGTH = 40;
    static final int MAX_PRODUCT_NAME_LENGTH = 255;

    public record CustomDepartment(UUID id, String name) {
    }

    public record Assignment(String productName, String department) {
    }

    public record Departments(List<CustomDepartment> custom, List<Assignment> assignments) {
    }

    public record AssignRequest(String productName, String department, String newDepartmentName) {
    }

    private final ShoppingDepartmentRepository departmentRepository;
    private final ShoppingDepartmentAssignmentRepository assignmentRepository;

    public ShoppingDepartmentService(ShoppingDepartmentRepository departmentRepository,
            ShoppingDepartmentAssignmentRepository assignmentRepository) {
        this.departmentRepository = departmentRepository;
        this.assignmentRepository = assignmentRepository;
    }

    static String normalizeProductName(String name) {
        return name == null ? "" : name.trim().replaceAll("\\s+", " ").toLowerCase(Locale.ROOT);
    }

    @Transactional(readOnly = true)
    public Departments list(UUID userId) {
        List<CustomDepartment> custom = departmentRepository.findByUserIdOrderByCreatedAtAscIdAsc(userId).stream()
                .map(department -> new CustomDepartment(department.getId(), department.getName()))
                .toList();
        List<Assignment> assignments = assignmentRepository.findByUserIdOrderByProductNameAsc(userId).stream()
                .map(assignment -> new Assignment(assignment.getProductName(), assignment.getDepartment()))
                .toList();
        return new Departments(custom, assignments);
    }

    @Transactional
    public Departments assign(UUID userId, AssignRequest request) {
        String productName = normalizeProductName(request.productName());
        if (productName.isEmpty() || productName.length() > MAX_PRODUCT_NAME_LENGTH) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "shopping.department.product-name-invalid");
        }
        String department = request.newDepartmentName() != null
                ? createOrFind(userId, request.newDepartmentName())
                : existingDepartment(userId, request.department());

        ShoppingDepartmentAssignment assignment = assignmentRepository.findByUserIdAndProductName(userId, productName)
                .orElseGet(() -> new ShoppingDepartmentAssignment(userId, productName));
        assignment.setDepartment(department);
        assignmentRepository.save(assignment);
        removeUnusedDepartments(userId);
        return list(userId);
    }

    private String existingDepartment(UUID userId, String department) {
        if (department == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "shopping.department.unknown");
        }
        if (BUILT_IN_DEPARTMENTS.contains(department)) {
            return department;
        }
        try {
            return departmentRepository.findByIdAndUserId(UUID.fromString(department), userId)
                    .map(found -> found.getId().toString())
                    .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "shopping.department.unknown"));
        } catch (IllegalArgumentException e) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "shopping.department.unknown");
        }
    }

    private String createOrFind(UUID userId, String rawName) {
        String name = rawName.trim().replaceAll("\\s+", " ");
        if (name.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "shopping.department.name-missing");
        }
        if (name.length() > MAX_NAME_LENGTH) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "shopping.department.name-too-long");
        }
        ShoppingDepartment department = departmentRepository.findByUserIdAndNameIgnoreCase(userId, name)
                .orElseGet(() -> departmentRepository.save(new ShoppingDepartment(userId, name)));
        return department.getId().toString();
    }

    private void removeUnusedDepartments(UUID userId) {
        Set<String> used = assignmentRepository.findByUserIdOrderByProductNameAsc(userId).stream()
                .map(ShoppingDepartmentAssignment::getDepartment)
                .collect(Collectors.toSet());
        departmentRepository.deleteAll(departmentRepository.findByUserIdOrderByCreatedAtAscIdAsc(userId).stream()
                .filter(department -> !used.contains(department.getId().toString()))
                .toList());
    }
}
