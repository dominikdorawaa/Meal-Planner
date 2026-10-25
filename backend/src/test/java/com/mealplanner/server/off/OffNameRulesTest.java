package com.mealplanner.server.off;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class OffNameRulesTest {

    @ParameterizedTest
    @ValueSource(strings = {"???", "12345", "A1", "Test", "  PRODUKT ", "brak nazwy", "Unknown!", "xxx"})
    void recognisesJunkNames(String name) {
        assertThat(OffNameRules.isJunkName(name)).isTrue();
    }

    @ParameterizedTest
    @ValueSource(strings = {"Ser", "Mleko 2%", "Jogurt naturalny", "Chleb żytni", "Test of taste"})
    void keepsRealNames(String name) {
        assertThat(OffNameRules.isJunkName(name)).isFalse();
    }

    @ParameterizedTest
    @ValueSource(strings = {"Chicken Fingers", "Orange juice", "Coconut Milk", "Cheese And Cranberry Flavoured Chips",
            "Grill Käse", "Pierogi Mit Sauerkraut", "Cookies with jelly cube & milk cream",
            "Арахіс смажений солоний", "Magija Сырок Waniliowy", "Lacta παγωτό", "מלפפונים שלמים", "脾气条",
            "Kysané podmáslí", "Barre céréales", "Nesfit ballı", "Cini Minis Scorțișoară", "Sonnenblumen Öl",
            "Ovesné smoothie s banánem, jahodami a jablkem", "Snack Festival Cornados (Jalapeño Cheese)", "Grøt",
            "Humus z červené řepy s žitným chlebem"})
    void recognisesForeignNames(String name) {
        assertThat(OffNameRules.isForeignName(name)).isTrue();
    }

    @ParameterizedTest
    @ValueSource(strings = {"Lech free limonka mięta", "ŁACIATE UHT MILK 2.0%", "Protein Drink O Smaku Waniliowym",
            "Lody Czekoladowe Z Sosem Czekoladowym", "Lech free yuzu i pomelo", "Milky Way", "Cheetos", "Jogurt naturalny",
            "Nestlé Corn Flakes", "Chipsy Jalapeño", "Serek Président", "Crème brûlée z wanilią", "Budyń •z cukrem•",
            "Roślinna kiełbaska à la Śląska", "Sos z jalapeño",
            "Müllermilch Zero Truskawkowy", "Nescafé Crema"})
    void keepsPolishNamesWithSingleForeignWordsOrLetters(String name) {
        assertThat(OffNameRules.isForeignName(name)).isFalse();
    }

    @ParameterizedTest(name = "{0}")
    @CsvSource(delimiter = '|', value = {
            "Mleko  2%|Mleko 2%",
            "  Mleko\t1,5 %  |Mleko 1,5%",
            "Mleko 0.5%|Mleko 0,5%",
            "3.5% Mleko UHT|3,5% Mleko UHT",
            "MLEKO UHT CZĘŚCIOWO ODTŁUSZCZONE 1.5%|Mleko uht częściowo odtłuszczone 1,5%",
            "ŚMIETANA 18%|Śmietana 18%",
            "3.2% MLEKO|3,2% Mleko",
            "BA! Kakao mleko|BA! Kakao mleko",
            "UHT|Uht",
            "WC|WC",
            "123 %|123%"
    })
    void normalizesNames(String name, String expected) {
        assertThat(OffNameRules.normalize(name)).isEqualTo(expected);
    }

    @Test
    void leavesNamesWithoutLettersUnchangedWhenNormalizing() {
        assertThat(OffNameRules.normalize("1234")).isEqualTo("1234");
        assertThat(OffNameRules.normalize("")).isEmpty();
    }

    @Test
    void addsFatPercentForDairyCategories() {
        assertThat(OffNameRules.withFatPercent("Mleko", 3.2, List.of("en:dairies", "en:milks"))).isEqualTo("Mleko 3,2%");
        assertThat(OffNameRules.withFatPercent("Jogurt naturalny", 3.0, List.of("en:yogurts")))
                .isEqualTo("Jogurt naturalny 3%");
        assertThat(OffNameRules.withFatPercent("Śmietanka", 17.96, List.of("en:creams"))).isEqualTo("Śmietanka 18%");
        assertThat(OffNameRules.withFatPercent("Kefir Robcio", 1.5, List.of("en:dairies", "en:kefir")))
                .isEqualTo("Kefir Robcio 1,5%");
    }

    @Test
    void addsFatPercentByTheFirstWordOfDairyProducts() {
        assertThat(OffNameRules.withFatPercent("Twaróg chudy", 0.5, List.of("en:dairies", "en:fresh-cheeses")))
                .isEqualTo("Twaróg chudy 0,5%");
        assertThat(OffNameRules.withFatPercent("Mleko kokosowe", 18.0, List.of("en:plant-milks")))
                .isEqualTo("Mleko kokosowe");
    }

    @Test
    void addsFatPercentByTheFirstWordWhenCategoriesAreMissing() {
        assertThat(OffNameRules.withFatPercent("Kefir naturalny", 2.0, List.of())).isEqualTo("Kefir naturalny 2%");
        assertThat(OffNameRules.withFatPercent("Śmietana", 12.0, List.of())).isEqualTo("Śmietana 12%");
        assertThat(OffNameRules.withFatPercent("Ser żółty", 26.0, List.of())).isEqualTo("Ser żółty");
        assertThat(OffNameRules.withFatPercent("...", 26.0, List.of())).isEqualTo("...");
    }

    @Test
    void keepsNamesWhenFatDoesNotDefineTheProduct() {
        assertThat(OffNameRules.withFatPercent("Mleko 2%", 2.0, List.of("en:milks"))).isEqualTo("Mleko 2%");
        assertThat(OffNameRules.withFatPercent("Mleko", null, List.of("en:milks"))).isEqualTo("Mleko");
        assertThat(OffNameRules.withFatPercent("", 3.2, List.of("en:milks"))).isEmpty();
        assertThat(OffNameRules.withFatPercent("Mleko", 3.2, List.of("en:cheeses"))).isEqualTo("Mleko");
        assertThat(OffNameRules.withFatPercent("Test", 3.2, List.of("en:milks"))).isEqualTo("Test");
    }
}
