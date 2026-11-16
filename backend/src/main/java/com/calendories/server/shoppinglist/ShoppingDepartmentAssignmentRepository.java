package com.calendories.server.shoppinglist;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ShoppingDepartmentAssignmentRepository extends JpaRepository<ShoppingDepartmentAssignment, UUID> {
    List<ShoppingDepartmentAssignment> findByUserIdOrderByProductNameAsc(UUID userId);

    Optional<ShoppingDepartmentAssignment> findByUserIdAndProductName(UUID userId, String productName);
}
