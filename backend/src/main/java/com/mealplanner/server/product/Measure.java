package com.mealplanner.server.product;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.Map;

public record Measure(String code, Double baseAmount, @JsonProperty("default") Boolean defaultMeasure,
                      Map<String, Map<String, String>> names, Double maxAmount) {

    public Measure {
        defaultMeasure = Boolean.TRUE.equals(defaultMeasure);
    }

    static Measure of(ProductMeasure stored) {
        MeasureKind kind = stored.getKind();
        return new Measure(kind.getCode(), stored.getBaseAmount(), stored.isDefaultMeasure(), kind.getNames(),
                kind.getMaxAmount());
    }
}
