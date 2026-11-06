package com.mealplanner.server.recipe;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonProperty;

public record RecipeStep(String name, String text) {

    public static final int MAX_NAME_LENGTH = 60;

    @JsonCreator(mode = JsonCreator.Mode.PROPERTIES)
    public RecipeStep(@JsonProperty("name") String name, @JsonProperty("text") String text) {
        String trimmedName = name == null ? "" : name.trim();
        this.name = trimmedName.isEmpty() ? null : trimmedName;
        this.text = text == null ? "" : text;
    }

    @JsonCreator(mode = JsonCreator.Mode.DELEGATING)
    public static RecipeStep fromText(String text) {
        return new RecipeStep(null, text);
    }

    boolean isEmpty() {
        return name == null && text.isBlank();
    }
}
