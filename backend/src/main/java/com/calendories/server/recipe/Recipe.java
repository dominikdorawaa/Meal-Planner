package com.calendories.server.recipe;

import com.fasterxml.jackson.annotation.JsonGetter;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonSetter;
import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Entity
@Table(name = "recipes")
@Data
@NoArgsConstructor
public class Recipe {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private String name;

    @Column(name = "image_url", length = 1024)
    @JsonProperty("image_url")
    private String imageUrl;

    private Double kcal = 0.0;
    private Double protein = 0.0;
    private Double fat = 0.0;
    private Double carbs = 0.0;

    @Column(name = "prep_time")
    @JsonProperty("prep_time")
    private Integer prepTime = 0;

    private Double portions = 1.0;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "instructions")
    private List<RecipeStep> steps;

    @Column(name = "is_archived", nullable = false)
    private Boolean isArchived = false;

    @Column(name = "created_by")
    private UUID createdBy;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @JsonProperty(access = JsonProperty.Access.READ_ONLY)
    private RecipeVisibility visibility = RecipeVisibility.PRIVATE;

    @Transient
    @JsonProperty(access = JsonProperty.Access.READ_ONLY)
    private boolean own;

    @Transient
    @JsonProperty(access = JsonProperty.Access.READ_ONLY)
    private boolean saved;

    @OneToMany(mappedBy = "recipe", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
    private List<RecipeIngredient> ingredients;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private OffsetDateTime createdAt;

    public Double getKcal() {
        return nutrition().map(RecipeNutrition::kcal).orElse(kcal);
    }

    public Double getProtein() {
        return nutrition().map(RecipeNutrition::protein).orElse(protein);
    }

    public Double getFat() {
        return nutrition().map(RecipeNutrition::fat).orElse(fat);
    }

    public Double getCarbs() {
        return nutrition().map(RecipeNutrition::carbs).orElse(carbs);
    }

    @JsonGetter("instructions")
    public List<String> legacyInstructions() {
        if (steps == null) {
            return List.of();
        }
        return steps.stream()
                .map(step -> step.text().isBlank() && step.name() != null ? step.name() : step.text())
                .toList();
    }

    @JsonSetter("instructions")
    public void applyLegacyInstructions(List<RecipeStep> legacySteps) {
        if (steps == null) {
            steps = legacySteps;
        }
    }

    void copyStoredNutrition(Recipe source) {
        kcal = source.kcal;
        protein = source.protein;
        fat = source.fat;
        carbs = source.carbs;
    }

    private Optional<RecipeNutrition> nutrition() {
        return RecipeNutrition.perPortion(ingredients, portions);
    }
}
