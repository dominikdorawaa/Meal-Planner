package com.example.demo.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.util.UUID;

@Entity
@Table(name = "recipe_ingredients")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class RecipeIngredient {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "recipe_id")
    @JsonIgnore
    private Recipe recipe;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private Double amount;

    @Column(nullable = false)
    private String unit;
}
