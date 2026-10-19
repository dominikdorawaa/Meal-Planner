package com.mealplanner.server.recipe;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.OffsetDateTime;
import java.util.List;
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
    private List<String> instructions;

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
}
