package com.calendories.server.recipe;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Embeddable
@Data
@NoArgsConstructor
@AllArgsConstructor
public class RecipeImage {

    static final double CENTER = 50.0;

    @Column(nullable = false, length = 1024)
    private String url;

    @Column(name = "focus_x", nullable = false)
    @JsonProperty("focus_x")
    private Double focusX = CENTER;

    @Column(name = "focus_y", nullable = false)
    @JsonProperty("focus_y")
    private Double focusY = CENTER;

    boolean hasUrl() {
        return url != null && !url.isBlank();
    }

    RecipeImage cleaned() {
        return new RecipeImage(url.trim(), clampFocus(focusX), clampFocus(focusY));
    }

    private static double clampFocus(Double value) {
        if (value == null || value.isNaN()) {
            return CENTER;
        }
        return Math.min(100.0, Math.max(0.0, value));
    }
}
