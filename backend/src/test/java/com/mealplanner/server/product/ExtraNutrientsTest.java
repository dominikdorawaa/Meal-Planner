package com.mealplanner.server.product;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class ExtraNutrientsTest {

    @Test
    void roundsToOneDecimalAndKeepsMissingValues() {
        assertThat(new ExtraNutrients(2.04, 3.96, null, 0.149).rounded())
                .isEqualTo(new ExtraNutrients(2.0, 4.0, null, 0.1));
    }

    @Test
    void leavesOutValuesThatCannotBeTrue() {
        assertThat(new ExtraNutrients(5.0, 3.0, -1.0, 101.0).plausibleFor(4.0, 3.0))
                .isEqualTo(new ExtraNutrients(null, 3.0, null, null));
        assertThat(new ExtraNutrients(5.0, 3.0, 2.0, 1.0).plausibleFor(null, null))
                .isEqualTo(new ExtraNutrients(5.0, 3.0, 2.0, 1.0));
    }

    @Test
    void copiesValuesToAndFromAProduct() {
        Product product = new Product();

        new ExtraNutrients(1.0, 2.0, 3.0, 4.0).applyTo(product);

        assertThat(ExtraNutrients.of(product)).isEqualTo(new ExtraNutrients(1.0, 2.0, 3.0, 4.0));
    }
}
