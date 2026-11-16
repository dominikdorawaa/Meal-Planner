package com.calendories.server.shoppinglist;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface ShoppingDepartmentAssignmentRepository extends JpaRepository<ShoppingDepartmentAssignment, UUID> {
    List<ShoppingDepartmentAssignment> findByUserIdOrderByProductNameAsc(UUID userId);

    @Modifying
    void deleteByUserIdAndDepartment(UUID userId, String department);

    @Modifying
    @Query(value = "insert into shopping_department_assignments (id, user_id, product_name, department) "
            + "values (gen_random_uuid(), :userId, :productName, :department) "
            + "on conflict (user_id, product_name) do update set department = excluded.department", nativeQuery = true)
    void upsert(UUID userId, String productName, String department);
}
