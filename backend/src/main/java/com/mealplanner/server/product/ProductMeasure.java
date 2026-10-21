package com.mealplanner.server.product;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.UUID;

@Entity
@Table(name = "product_measures")
@Getter
@Setter
@NoArgsConstructor
public class ProductMeasure {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "kind_code", nullable = false)
    private MeasureKind kind;

    @Column(name = "base_amount", nullable = false)
    private Double baseAmount;

    @Column(name = "is_default", nullable = false)
    private boolean defaultMeasure;

    @Column(nullable = false)
    private Integer position;

    public ProductMeasure(Product product, MeasureKind kind) {
        this.product = product;
        this.kind = kind;
    }
}
