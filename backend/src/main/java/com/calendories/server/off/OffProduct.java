package com.calendories.server.off;

import com.calendories.server.product.ExtraNutrients;

public record OffProduct(String code, String name, String brand, Double kcal, Double protein, Double fat,
                         Double carbs, ExtraNutrients extras, String quantity, boolean polishName,
                         OffMeasureFacts measureFacts) {
}
