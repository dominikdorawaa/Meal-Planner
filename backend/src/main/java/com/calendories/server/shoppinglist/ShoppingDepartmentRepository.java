package com.calendories.server.shoppinglist;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ShoppingDepartmentRepository extends JpaRepository<ShoppingDepartment, UUID> {
    List<ShoppingDepartment> findByUserIdOrderByCreatedAtAscIdAsc(UUID userId);

    Optional<ShoppingDepartment> findByUserIdAndNameIgnoreCase(UUID userId, String name);

    Optional<ShoppingDepartment> findByIdAndUserId(UUID id, UUID userId);
}
