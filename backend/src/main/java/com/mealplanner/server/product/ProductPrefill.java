package com.mealplanner.server.product;

import com.mealplanner.server.off.OffProduct;

public record ProductPrefill(String name, String brand, Double kcal, Double protein, Double fat, Double carbs) {

    public static ProductPrefill from(OffProduct product) {
        return new ProductPrefill(product.name(), product.brand(), product.kcal(), product.protein(), product.fat(),
                product.carbs());
    }
}
