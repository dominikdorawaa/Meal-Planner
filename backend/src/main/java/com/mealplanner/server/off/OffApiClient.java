package com.mealplanner.server.off;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.time.Duration;
import java.util.Optional;

@Component
public class OffApiClient {

    static final String FIELDS = "code,lang,product_name,product_name_pl,product_name_en,generic_name_pl,brands,quantity,nutriments";

    private static final JsonMapper MAPPER = JsonMapper.builder().build();

    private final RestClient restClient;

    public OffApiClient(@Value("${off.api.base-url:https://world.openfoodfacts.org}") String baseUrl,
                        @Value("${off.api.user-agent:MealPlanner/1.0 (https://github.com/dominikdorawaa/Meal-Planner)}") String userAgent,
                        @Value("${off.api.timeout:3s}") Duration timeout) {
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(timeout);
        requestFactory.setReadTimeout(timeout);
        this.restClient = RestClient.builder()
                .baseUrl(baseUrl)
                .requestFactory(requestFactory)
                .defaultHeader(HttpHeaders.USER_AGENT, userAgent)
                .build();
    }

    public Optional<OffProduct> findProduct(String barCode) {
        JsonNode response;
        try {
            String body = restClient.get()
                    .uri("/api/v2/product/{code}?fields={fields}", barCode, FIELDS)
                    .retrieve()
                    .body(String.class);
            response = body == null ? null : MAPPER.readTree(body);
        } catch (RestClientResponseException exception) {
            if (exception.getStatusCode().value() == 404) {
                return Optional.empty();
            }
            throw new OffUnavailableException(exception);
        } catch (RestClientException | JacksonException exception) {
            throw new OffUnavailableException(exception);
        }
        JsonNode status = response == null ? null : response.path("status");
        if (status != null && status.isNumber() && status.asInt() == 0) {
            return Optional.empty();
        }
        if (status == null || !status.isNumber() || status.asInt() != 1 || !response.path("product").isObject()) {
            throw new OffUnavailableException(new IllegalStateException("Unexpected Open Food Facts response"));
        }
        return Optional.of(OffProductParser.fromNode(response.path("product")));
    }
}
