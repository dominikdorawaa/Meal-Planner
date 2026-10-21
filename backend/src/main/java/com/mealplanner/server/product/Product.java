package com.mealplanner.server.product;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.ToString;
import org.hibernate.annotations.BatchSize;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.Fetch;
import org.hibernate.annotations.FetchMode;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
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

    @JsonIgnore
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    @OneToMany(mappedBy = "product", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
    @Fetch(FetchMode.SELECT)
    @BatchSize(size = 100)
    @OrderBy("position")
    private List<ProductMeasure> storedMeasures = new ArrayList<>();

    @JsonIgnore
    @Transient
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private List<Measure> requestedMeasures;

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

    public void addMeasure(MeasureKind kind, double baseAmount) {
        ProductMeasure measure = new ProductMeasure(this, kind);
        measure.setBaseAmount(baseAmount);
        measure.setPosition(storedMeasures.size());
        storedMeasures.add(measure);
    }

    @JsonProperty("measures")
    public List<Measure> getMeasures() {
        return ProductMeasures.describe(unit, storedMeasures);
    }

    @JsonProperty("measures")
    public void setMeasures(List<Measure> measures) {
        requestedMeasures = measures;
    }
}
