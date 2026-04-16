package com.example.demo.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.util.UUID;
import org.springframework.data.domain.Persistable;

@Entity
@Table(name = "user_profiles")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class UserProfile implements Persistable<UUID> {

    @Id
    private UUID id;

    @JsonIgnore
    @OneToOne(fetch = FetchType.LAZY)
    @MapsId
    @JoinColumn(name = "id")
    private User user;

    @Transient
    @JsonIgnore
    private boolean isNewProfile = false;

    @JsonIgnore
    @Override
    public boolean isNew() {
        return isNewProfile;
    }

    /** Nazwa pokazywana w aplikacji (niezależna od imienia przy rejestracji). */
    @Column(name = "display_name")
    private String displayName;

    private String gender;
    private Integer age;
    private Double weight;
    private Double height;

    @Column(name = "target_weight")
    private Double targetWeight;

    @Column(name = "lifestyle_activity")
    private Double lifestyleActivity;

    @Column(name = "exercise_activity")
    private Double exerciseActivity;

    private String activity;
    private String goal;

    @Column(name = "change_speed")
    private Double changeSpeed;

    @Column(name = "is_manual_macros")
    private Boolean isManualMacros = false;

    @Column(name = "target_kcal")
    private Integer targetKcal;

    @Column(name = "target_protein")
    private Integer targetProtein;

    @Column(name = "target_fat")
    private Integer targetFat;

    @Column(name = "target_carbs")
    private Integer targetCarbs;

    @Column(name = "target_protein_min")
    private Integer targetProteinMin;

    @Column(name = "target_protein_max")
    private Integer targetProteinMax;

    @Column(name = "target_fat_min")
    private Integer targetFatMin;

    @Column(name = "target_fat_max")
    private Integer targetFatMax;

    @Column(name = "target_carbs_min")
    private Integer targetCarbsMin;

    @Column(name = "target_carbs_max")
    private Integer targetCarbsMax;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "meal_config")
    private JsonNode mealConfig;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "visible_meals")
    private JsonNode visibleMeals;
}
