package com.mealplanner.server.off;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import tools.jackson.databind.json.JsonMapper;

import java.util.LinkedHashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class OffProductParserTest {

    private static final JsonMapper MAPPER = JsonMapper.builder().build();

    private static OffProduct parse(String code, String lang, String polishName, String mainName,
                                    String genericPolishName, String englishName) {
        Map<String, Object> node = new LinkedHashMap<>();
        node.put("code", code);
        node.put("lang", lang);
        node.put("product_name_pl", polishName);
        node.put("product_name", mainName);
        node.put("generic_name_pl", genericPolishName);
        node.put("product_name_en", englishName);
        return OffProductParser.fromNode(MAPPER.valueToTree(node));
    }

    @ParameterizedTest(name = "{0}")
    @CsvSource(delimiter = '|', nullValues = "null", value = {
            "Polish name is used|4000417025005|de|Śmietanka 18%|Sahne|null|null|Śmietanka 18%|true",
            "longer Polish generic name adds details|4000417025005|pl|Śmietanka|Śmietanka|Śmietanka 18%|null|Śmietanka 18%|true",
            "unrelated generic name is ignored|4000417025005|pl|Śmietanka|Śmietanka|Produkt mleczny|null|Śmietanka|true",
            "main name of a Polish product is used|4000417025005|pl|null|Kefir naturalny|null|null|Kefir naturalny|true",
            "Polish generic name replaces a foreign name|4000417025005|de|null|Stracciatella Pasta Filata Käse|Ser stracciatella|null|Ser stracciatella|true",
            "foreign name is marked as not Polish|4000417025005|de|null|Stracciatella Pasta Filata Käse|null|null|Stracciatella Pasta Filata Käse|false",
            "missing names give an empty foreign name|4000417025005|null|null|null|null|null|''|false",
            "English name replaces a foreign name|4000417025005|ar|null|شوكولاتة|null|Milk chocolate candies|Milk chocolate candies|false",
            "non-Latin name without English name gives an empty name|4000417025005|ar|null|شوكولاتة|null|null|''|false",
            "Polish barcode makes the main name Polish|5901044028737|en|null|Texas sos BBQ|null|Texas sos BBQ|Texas sos BBQ|true",
            "short barcode starting like a Polish one is not Polish|59010440|en|null|Texas sauce|null|null|Texas sauce|false"
    })
    void picksTheMostCompletePolishName(String description, String code, String lang, String polishName,
                                        String mainName, String genericPolishName, String englishName, String expectedName,
                                        boolean expectedPolish) {
        OffProduct product = parse(code, lang, polishName, mainName, genericPolishName, englishName);

        assertThat(product.name()).isEqualTo(expectedName);
        assertThat(product.polishName()).isEqualTo(expectedPolish);
    }
}
