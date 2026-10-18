package com.mealplanner.server.product;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;

import static org.assertj.core.api.Assertions.assertThat;

class PackageWeightTest {

    @ParameterizedTest
    @CsvSource(delimiter = '|', value = {
            "500 g|100g|500",
            "500g|100g|500",
            "1 kg|100g|1000",
            "0,75 kg|100g|750",
            "4 x 125 g|100g|500",
            "6x20g|100g|120",
            "2 × 1,5 kg|100g|3000",
            "500 g ℮|100g|500",
            "400 G e|100g|400",
            "500 g (10 x 50 g)|100g|500",
            "330 ml|100ml|330",
            "1,5 l|100ml|1500",
            "1.5L|100ml|1500",
            "25 cl|100ml|250",
            "33,3 g|100g|33.3"
    })
    void readsPackageWeightInTheProductUnit(String quantity, String unit, double expected) {
        assertThat(PackageWeight.parse(quantity, unit)).isEqualTo(expected);
    }

    @ParameterizedTest
    @CsvSource(delimiter = '|', value = {
            "330 ml|100g",
            "1 l|100g",
            "500 g|100ml",
            "500 g|pc",
            "500 g|"
    })
    void ignoresQuantityInAnotherUnit(String quantity, String unit) {
        assertThat(PackageWeight.parse(quantity, unit)).isNull();
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {"duże opakowanie", "500", "0 g", "1 szt", "ok. 500 g", "500 g / 2 porcje", "50 kg 1"})
    void ignoresUnreadableQuantity(String quantity) {
        assertThat(PackageWeight.parse(quantity, "100g")).isNull();
    }

    @Test
    void ignoresUnrealisticallyLargePackages() {
        assertThat(PackageWeight.parse("50 kg", "100g")).isEqualTo(50_000.0);
        assertThat(PackageWeight.parse("51 kg", "100g")).isNull();
    }

    @Test
    void acceptsOnlyPositiveRealisticWeights() {
        assertThat(PackageWeight.isValid(null)).isTrue();
        assertThat(PackageWeight.isValid(250.0)).isTrue();
        assertThat(PackageWeight.isValid(50_000.0)).isTrue();
        assertThat(PackageWeight.isValid(0.0)).isFalse();
        assertThat(PackageWeight.isValid(-5.0)).isFalse();
        assertThat(PackageWeight.isValid(50_001.0)).isFalse();
        assertThat(PackageWeight.isValid(Double.NaN)).isFalse();
        assertThat(PackageWeight.isValid(Double.POSITIVE_INFINITY)).isFalse();
    }
}
