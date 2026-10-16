package com.mealplanner.server.product;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;

import static org.assertj.core.api.Assertions.assertThat;

class ProductSearchTextTest {

    @ParameterizedTest
    @CsvSource(delimiter = '|', value = {
            "Żółty ser|zolty ser",
            "ŁOSOŚ wędzony|losos wedzony",
            "  Jogurt   naturalny 2%  |jogurt naturalny 2",
            "Crème brûlée|creme brulee",
            "Mleko 3,2% UHT|mleko 3 2 uht",
            "a_b%c|a b c"
    })
    void normalizesTextForSearch(String input, String expected) {
        assertThat(ProductSearchText.normalize(input)).isEqualTo(expected);
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {"%%%", "   "})
    void returnsEmptyTextWhenNothingIsSearchable(String input) {
        assertThat(ProductSearchText.normalize(input)).isEmpty();
    }

    @Test
    void combinesNameAndBrand() {
        assertThat(ProductSearchText.of("Skyr naturalny", "Piątnica")).isEqualTo("skyr naturalny piatnica");
        assertThat(ProductSearchText.of("Skyr", null)).isEqualTo("skyr");
    }
}
