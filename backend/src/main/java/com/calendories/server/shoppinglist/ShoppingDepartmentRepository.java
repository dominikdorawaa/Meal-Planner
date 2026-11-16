package com.calendories.server.shoppinglist;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ShoppingDepartmentRepository extends JpaRepository<ShoppingDepartment, UUID> {
    List<ShoppingDepartment> findByUserIdOrderByCreatedAtAscIdAsc(UUID userId);

    Optional<ShoppingDepartment> findByUserIdAndNameIgnoreCase(UUID userId, String name);

    Optional<ShoppingDepartment> findByIdAndUserId(UUID id, UUID userId);

    @Modifying
    @Query(value = "insert into shopping_departments (id, user_id, name) values (gen_random_uuid(), :userId, :name) "
            + "on conflict (user_id, lower(name)) do nothing", nativeQuery = true)
    void insertIfMissing(UUID userId, String name);
}
