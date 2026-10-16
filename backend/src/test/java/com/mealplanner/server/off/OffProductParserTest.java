package com.mealplanner.server.off;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import tools.jackson.databind.json.JsonMapper;

import java.util.LinkedHashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class OffProductParserTest {

    private static final JsonMapper MAPPER = JsonMapper.builder().build();

    private static OffProduct parse(String lang, String polishName, String mainName, String genericPolishName) {
        Map<String, Object> node = new LinkedHashMap<>();
        node.put("code", "5900820000318");
        node.put("lang", lang);
        node.put("product_name_pl", polishName);
        node.put("product_name", mainName);
        node.put("generic_name_pl", genericPolishName);
        return OffProductParser.fromNode(MAPPER.valueToTree(node));
    }

    @ParameterizedTest(name = "{0}")
    @CsvSource(delimiter = '|', nullValues = "null", value = {
            "Polish name is used|de|Śmietanka 18%|Sahne|null|Śmietanka 18%|true",
            "longer Polish generic name adds details|pl|Śmietanka|Śmietanka|Śmietanka 18%|Śmietanka 18%|true",
            "unrelated generic name is ignored|pl|Śmietanka|Śmietanka|Produkt mleczny|Śmietanka|true",
            "main name of a Polish product is used|pl|null|Kefir naturalny|null|Kefir naturalny|true",
            "Polish generic name replaces a foreign name|de|null|Stracciatella Pasta Filata Käse|Ser stracciatella|Ser stracciatella|true",
            "foreign name is marked as not Polish|de|null|Stracciatella Pasta Filata Käse|null|Stracciatella Pasta Filata Käse|false",
            "missing names give an empty foreign name|null|null|null|null|''|false"
    })
    void picksTheMostCompletePolishName(String description, String lang, String polishName, String mainName,
                                        String genericPolishName, String expectedName, boolean expectedPolish) {
        OffProduct product = parse(lang, polishName, mainName, genericPolishName);

        assertThat(product.name()).isEqualTo(expectedName);
        assertThat(product.polishName()).isEqualTo(expectedPolish);
    }
}
