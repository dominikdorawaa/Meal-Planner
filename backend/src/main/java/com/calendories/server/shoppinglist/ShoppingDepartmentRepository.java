package com.calendories.server.shoppinglist;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ShoppingDepartmentRepository extends JpaRepository<ShoppingDepartment, UUID> {
    List<ShoppingDepartment> findByUserIdOrderByCreatedAtAscIdAsc(UUID userId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select d from ShoppingDepartment d where d.userId = :userId and lower(d.name) = lower(:name)")
    Optional<ShoppingDepartment> lockByUserIdAndName(UUID userId, String name);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select d from ShoppingDepartment d where d.id = :id and d.userId = :userId")
    Optional<ShoppingDepartment> lockByIdAndUserId(UUID id, UUID userId);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query(value = "insert into shopping_departments (id, user_id, name) values (gen_random_uuid(), :userId, :name) "
            + "on conflict (user_id, lower(name)) do nothing", nativeQuery = true)
    void insertIfMissing(UUID userId, String name);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("delete from ShoppingDepartment d where d.id = :id")
    void deleteDepartment(UUID id);
}
