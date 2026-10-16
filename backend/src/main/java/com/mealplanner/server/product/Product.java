package com.mealplanner.server.product;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "products")
@Data
@NoArgsConstructor
public class Product {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private String name;

    private String brand;

    private Double kcal;

    private Double protein;

    private Double fat;

    private Double carbs;

    private String unit;

    @Column(name = "bar_code")
    private String barCode;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ProductStatus status = ProductStatus.VERIFIED;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ProductSource source = ProductSource.USER;

    @Column(name = "created_by")
    private UUID createdBy;

    @JsonIgnore
    @Column(name = "deleted_at")
    private OffsetDateTime deletedAt;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private OffsetDateTime createdAt;
}
