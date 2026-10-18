package com.mealplanner.server.product;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
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

    @Column(name = "saturated_fat")
    private Double saturatedFat;

    private Double sugars;

    private Double fiber;

    private Double salt;

    private String unit;

    @Column(name = "package_weight")
    private Double packageWeight;

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

    @JsonIgnore
    @Column(name = "search_text", nullable = false)
    private String searchText = "";

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private OffsetDateTime createdAt;

    @PrePersist
    @PreUpdate
    void beforeSave() {
        searchText = ProductSearchText.of(name, brand);
        kcal = NutritionRounding.kcal(kcal);
        protein = NutritionRounding.grams(protein);
        fat = NutritionRounding.grams(fat);
        carbs = NutritionRounding.grams(carbs);
        ExtraNutrients.of(this).rounded().applyTo(this);
    }

    @JsonProperty(value = "deleted", access = JsonProperty.Access.READ_ONLY)
    public boolean isDeleted() {
        return deletedAt != null;
    }
}
