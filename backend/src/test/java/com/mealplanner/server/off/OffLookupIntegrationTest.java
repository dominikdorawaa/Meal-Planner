package com.mealplanner.server.off;

import com.mealplanner.server.TestcontainersConfiguration;
import com.mealplanner.server.product.Product;
import com.mealplanner.server.product.ProductRepository;
import com.mealplanner.server.product.ProductSource;
import com.mealplanner.server.product.ProductStatus;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.Executors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class OffLookupIntegrationTest {

    private static final String COMPLETE = "5900820000318";
    private static final String INCOMPLETE = "5901234123457";
    private static final String UNKNOWN = "96385074";
    private static final String BROKEN = "036000291452";
    private static final String SLOW = "4006381333931";

    private static final Map<String, Integer> REQUESTS = new ConcurrentHashMap<>();
    private static final List<String> USER_AGENTS = new CopyOnWriteArrayList<>();
    private static final HttpServer SERVER = startServer();

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ProductRepository productRepository;

    private static HttpServer startServer() {
        try {
            HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
            server.createContext("/api/v2/product/", exchange -> {
                String code = exchange.getRequestURI().getPath().substring("/api/v2/product/".length());
                REQUESTS.merge(code, 1, Integer::sum);
                USER_AGENTS.add(exchange.getRequestHeaders().getFirst("User-Agent"));
                int status = 200;
                String body = switch (code) {
                    case COMPLETE -> "{\"status\":1,\"product\":{\"product_name_pl\":\"Skyr naturalny\",\"brands\":\"Piątnica\","
                            + "\"nutriments\":{\"energy-kcal_100g\":65,\"proteins_100g\":12,\"fat_100g\":0,\"carbohydrates_100g\":4.2}}}";
                    case INCOMPLETE -> "{\"status\":1,\"product\":{\"product_name\":\"Baton\",\"brands\":\"Wedel\","
                            + "\"nutriments\":{\"energy-kcal_100g\":480,\"proteins_100g\":5}}}";
                    case BROKEN -> {
                        status = 500;
                        yield "{}";
                    }
                    case SLOW -> {
                        sleep();
                        yield "{\"status\":0}";
                    }
                    default -> "{\"status\":0,\"status_verbose\":\"product not found\"}";
                };
                byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
                exchange.getResponseHeaders().add("Content-Type", "application/json");
                exchange.sendResponseHeaders(status, bytes.length);
                try (OutputStream out = exchange.getResponseBody()) {
                    out.write(bytes);
                }
            });
            server.setExecutor(Executors.newCachedThreadPool());
            server.start();
            return server;
        } catch (IOException exception) {
            throw new IllegalStateException(exception);
        }
    }

    private static void sleep() {
        try {
            Thread.sleep(1500);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
        }
    }

    @DynamicPropertySource
    static void openFoodFacts(DynamicPropertyRegistry registry) {
        registry.add("off.api.base-url", () -> "http://127.0.0.1:" + SERVER.getAddress().getPort());
        registry.add("off.api.timeout", () -> "500ms");
        registry.add("off.api.user-agent", () -> "MealPlanner-Test/1.0");
    }

    @AfterAll
    static void stopServer() {
        SERVER.stop(0);
    }

    @BeforeEach
    void reset() {
        REQUESTS.clear();
        USER_AGENTS.clear();
    }

    @Test
    void savesAndReturnsACompleteProductFoundInOpenFoodFacts() throws Exception {
        mockMvc.perform(get("/api/products/barcode/" + COMPLETE))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Skyr naturalny"))
                .andExpect(jsonPath("$.brand").value("Piątnica"))
                .andExpect(jsonPath("$.status").value("VERIFIED"))
                .andExpect(jsonPath("$.source").value("OFF"));

        Product saved = productRepository.findByBarCodeAndStatusAndDeletedAtIsNull(COMPLETE, ProductStatus.VERIFIED).orElseThrow();
        assertThat(saved.getSource()).isEqualTo(ProductSource.OFF);
        assertThat(saved.getUnit()).isEqualTo("100g");
        assertThat(USER_AGENTS).containsExactly("MealPlanner-Test/1.0");

        mockMvc.perform(get("/api/products/barcode/" + COMPLETE)).andExpect(status().isOk());
        assertThat(REQUESTS.get(COMPLETE)).isEqualTo(1);
    }

    @Test
    void returnsPrefillDataForAnIncompleteProductWithoutSavingIt() throws Exception {
        mockMvc.perform(get("/api/products/barcode/" + INCOMPLETE))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("Nie znaleziono produktu z tym kodem kreskowym."))
                .andExpect(jsonPath("$.prefill.name").value("Baton"))
                .andExpect(jsonPath("$.prefill.brand").value("Wedel"))
                .andExpect(jsonPath("$.prefill.kcal").value(480.0))
                .andExpect(jsonPath("$.prefill.fat").doesNotExist());

        assertThat(productRepository.findByBarCodeAndStatusAndDeletedAtIsNull(INCOMPLETE, ProductStatus.VERIFIED)).isEmpty();
    }

    @Test
    void remembersCodesUnknownToOpenFoodFacts() throws Exception {
        mockMvc.perform(get("/api/products/barcode/" + UNKNOWN))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.prefill").doesNotExist());
        mockMvc.perform(get("/api/products/barcode/" + UNKNOWN)).andExpect(status().isNotFound());

        assertThat(REQUESTS.get(UNKNOWN)).isEqualTo(1);
    }

    @Test
    void treatsServerErrorsAndTimeoutsAsNotFoundAndTriesAgainLater() throws Exception {
        mockMvc.perform(get("/api/products/barcode/" + BROKEN)).andExpect(status().isNotFound());
        mockMvc.perform(get("/api/products/barcode/" + BROKEN)).andExpect(status().isNotFound());
        mockMvc.perform(get("/api/products/barcode/" + SLOW)).andExpect(status().isNotFound());

        assertThat(REQUESTS.get(BROKEN)).isEqualTo(2);
        assertThat(REQUESTS.get(SLOW)).isEqualTo(1);
    }

    @Test
    void doesNotAskOpenFoodFactsAboutInvalidCodes() throws Exception {
        mockMvc.perform(get("/api/products/barcode/5900820000319")).andExpect(status().isNotFound());
        mockMvc.perform(get("/api/products/barcode/abc")).andExpect(status().isNotFound());

        assertThat(REQUESTS).isEmpty();
    }
}
