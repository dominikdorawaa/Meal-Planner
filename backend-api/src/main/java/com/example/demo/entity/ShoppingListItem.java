package com.example.demo.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "shopping_list")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ShoppingListItem {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "ingredient_name", nullable = false)
    private String ingredientName;

    private Double quantity;

    private String unit;

    @Column(name = "is_checked")
    private Boolean isChecked = false;

    private String category;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "recipe_id")
    private Recipe recipe;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private OffsetDateTime createdAt;
}
