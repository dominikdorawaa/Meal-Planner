package com.mealplanner.server.product;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.util.Map;

@Entity
@Table(name = "measure_kinds")
@Data
@NoArgsConstructor
public class MeasureKind {

    @Id
    private String code;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false)
    private Map<String, Map<String, String>> names;

    @Column(name = "max_amount", nullable = false)
    private Double maxAmount;

    @Column(name = "max_base_amount", nullable = false)
    private Double maxBaseAmount;

    @Column(name = "sort_order", nullable = false)
    private Integer sortOrder;
}
