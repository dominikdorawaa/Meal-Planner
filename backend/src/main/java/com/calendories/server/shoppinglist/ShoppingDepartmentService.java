package com.calendories.server.shoppinglist;

import com.calendories.server.handler.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

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
        return collapseSpaces(name).toLowerCase(Locale.ROOT);
    }

    static String collapseSpaces(String text) {
        return text == null ? "" : text.replaceAll("(?U)\\s+", " ").strip();
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

        assignmentRepository.upsert(userId, productName, department);
        return list(userId);
    }

    @Transactional
    public Departments delete(UUID userId, String departmentId) {
        ShoppingDepartment department = ownDepartment(userId, departmentId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "shopping.department.unknown"));
        assignmentRepository.deleteByUserIdAndDepartment(userId, department.getId().toString());
        departmentRepository.delete(department);
        return list(userId);
    }

    private Optional<ShoppingDepartment> ownDepartment(UUID userId, String departmentId) {
        try {
            return departmentRepository.findByIdAndUserId(UUID.fromString(departmentId), userId);
        } catch (IllegalArgumentException e) {
            return Optional.empty();
        }
    }

    private String existingDepartment(UUID userId, String department) {
        if (department == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "shopping.department.unknown");
        }
        if (BUILT_IN_DEPARTMENTS.contains(department)) {
            return department;
        }
        return ownDepartment(userId, department)
                .map(found -> found.getId().toString())
                .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "shopping.department.unknown"));
    }

    private String createOrFind(UUID userId, String rawName) {
        String name = collapseSpaces(rawName);
        if (name.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "shopping.department.name-missing");
        }
        if (name.length() > MAX_NAME_LENGTH) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "shopping.department.name-too-long");
        }
        departmentRepository.insertIfMissing(userId, name);
        return departmentRepository.findByUserIdAndNameIgnoreCase(userId, name).orElseThrow().getId().toString();
    }
}
