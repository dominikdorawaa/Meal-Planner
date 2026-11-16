package com.calendories.server.shoppinglist;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "shopping_department_assignments")
@Data
@NoArgsConstructor
public class ShoppingDepartmentAssignment {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "product_name", nullable = false)
    private String productName;

    @Column(nullable = false, length = 64)
    private String department;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private OffsetDateTime createdAt;

    public ShoppingDepartmentAssignment(UUID userId, String productName) {
        this.userId = userId;
        this.productName = productName;
    }
}
