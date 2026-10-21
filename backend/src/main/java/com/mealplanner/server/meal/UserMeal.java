package com.mealplanner.server.meal;

import com.mealplanner.server.product.Product;
import com.mealplanner.server.recipe.Recipe;
import com.mealplanner.server.user.User;
import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "user_meals")
@Data
@NoArgsConstructor
public class UserMeal {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "meal_date", nullable = false)
    private LocalDate mealDate;

    @Column(name = "meal_type", nullable = false)
    private String mealType;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "recipe_id")
    private Recipe recipe;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "product_id")
    private Product product;

    @Column(name = "portions_consumed")
    private Double portionsConsumed = 1.0;

    @Column(name = "measure_code")
    private String measureCode;

    @Column(name = "measure_amount")
    private Double measureAmount;

    @Column(name = "manual_name")
    private String manualName;

    @Column(name = "manual_kcal")
    private Double manualKcal;

    @Column(name = "manual_protein")
    private Double manualProtein;

    @Column(name = "manual_fat")
    private Double manualFat;

    @Column(name = "manual_carbs")
    private Double manualCarbs;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private OffsetDateTime createdAt;
}
