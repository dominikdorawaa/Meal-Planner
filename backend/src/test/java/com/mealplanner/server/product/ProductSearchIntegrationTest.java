package com.mealplanner.server.product;

import com.mealplanner.server.TestcontainersConfiguration;
import com.mealplanner.server.auth.JwtService;
import com.mealplanner.server.user.User;
import com.mealplanner.server.user.UserRepository;
import com.mealplanner.server.user.UserRole;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.time.OffsetDateTime;
import java.util.UUID;

import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class ProductSearchIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ProductRepository productRepository;

    private User saveUser() {
        User user = new User();
        user.setEmail("user-" + UUID.randomUUID() + "@example.com");
        user.setPasswordHash("hash");
        user.setRole(UserRole.USER);
        return userRepository.save(user);
    }

    private String bearer(User user) {
        return "Bearer " + jwtService.generateToken(user.getId(), user.getEmail());
    }

    private Product saveProduct(String name, String brand) {
        return saveProduct(name, brand, ProductStatus.VERIFIED, null);
    }

    private Product saveProduct(String name, String brand, ProductStatus status, UUID createdBy) {
        Product product = new Product();
        product.setName(name);
        product.setBrand(brand);
        product.setBarCode("test-" + UUID.randomUUID());
        product.setStatus(status);
        product.setCreatedBy(createdBy);
        product.setKcal(100.0);
        product.setProtein(10.0);
        product.setFat(5.0);
        product.setCarbs(10.0);
        return productRepository.save(product);
    }

    private MockHttpServletRequestBuilder search(String query) {
        return get("/api/products/search").param("q", query);
    }

    @Test
    void findsProductsWithoutPolishCharactersInTheQuery() throws Exception {
        Product product = saveProduct("Żółty ser gouda plastry", "Mlekovita");

        mockMvc.perform(search("zolty ser gouda"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[*].id", hasItem(product.getId().toString())));
    }

    @Test
    void findsProductsWithPolishCharactersAndCapitalLettersInTheQuery() throws Exception {
        Product product = saveProduct("Zolty ser edamski", null);

        mockMvc.perform(search("ŻÓŁTY SER EDAMSKI"))
                .andExpect(jsonPath("$.items[*].id", hasItem(product.getId().toString())));
    }

    @Test
    void toleratesTyposAndWordOrder() throws Exception {
        Product product = saveProduct("Mozzarella kulka", "Galbani");

        mockMvc.perform(search("mozarella"))
                .andExpect(jsonPath("$.items[*].id", hasItem(product.getId().toString())));
        mockMvc.perform(search("kulka mozzarella"))
                .andExpect(jsonPath("$.items[*].id", hasItem(product.getId().toString())));
    }

    @Test
    void findsProductsByBrand() throws Exception {
        Product product = saveProduct("Serek wiejski lekki", "Piątnica");

        mockMvc.perform(search("piatnica"))
                .andExpect(jsonPath("$.items[*].id", hasItem(product.getId().toString())));
    }

    @Test
    void findsProductsContainingEveryWordInAnyPlace() throws Exception {
        Product product = saveProduct("Kefir naturalny butelka", "Bieluch");
        Product other = saveProduct("Kefir truskawkowy butelka", "Zott");

        mockMvc.perform(search("bieluch kefir"))
                .andExpect(jsonPath("$.items[0].id").value(product.getId().toString()))
                .andExpect(jsonPath("$.items[*].id", not(hasItem(other.getId().toString()))));
    }

    @Test
    void putsExactBarCodeMatchFirst() throws Exception {
        Product product = saveProduct("Baton proteinowy kokos", null);

        mockMvc.perform(search(product.getBarCode()))
                .andExpect(jsonPath("$.items[0].id").value(product.getId().toString()));
    }

    @Test
    void ranksNamesStartingWithTheQueryBeforeOtherMatches() throws Exception {
        Product inside = saveProduct("Napoj kokosowy nieslodzony", null);
        Product prefix = saveProduct("Kokosowy jogurt roslinny", null);

        mockMvc.perform(search("kokosowy"))
                .andExpect(jsonPath("$.items[0].id").value(prefix.getId().toString()))
                .andExpect(jsonPath("$.items[1].id").value(inside.getId().toString()));
    }

    @Test
    void showsVerifiedProductsAndOnlyTheUsersOwnPendingOnes() throws Exception {
        User user = saveUser();
        User otherUser = saveUser();
        Product verified = saveProduct("Hummus klasyczny widocznosc", null);
        Product ownPending = saveProduct("Hummus pikantny widocznosc", null, ProductStatus.PENDING, user.getId());
        Product otherPending = saveProduct("Hummus paprykowy widocznosc", null, ProductStatus.PENDING, otherUser.getId());
        Product rejected = saveProduct("Hummus czosnkowy widocznosc", null, ProductStatus.REJECTED, user.getId());
        Product deleted = saveProduct("Hummus suszony widocznosc", null);
        deleted.setDeletedAt(OffsetDateTime.now());
        productRepository.save(deleted);

        mockMvc.perform(search("hummus widocznosc").header(HttpHeaders.AUTHORIZATION, bearer(user)))
                .andExpect(jsonPath("$.items[*].id", hasItem(verified.getId().toString())))
                .andExpect(jsonPath("$.items[*].id", hasItem(ownPending.getId().toString())))
                .andExpect(jsonPath("$.items[*].id", not(hasItem(otherPending.getId().toString()))))
                .andExpect(jsonPath("$.items[*].id", not(hasItem(rejected.getId().toString()))))
                .andExpect(jsonPath("$.items[*].id", not(hasItem(deleted.getId().toString()))));
        mockMvc.perform(search("hummus widocznosc"))
                .andExpect(jsonPath("$.items[*].id", contains(verified.getId().toString())));
    }

    @Test
    void returnsResultsPageByPage() throws Exception {
        saveProduct("Granola orzechowa stronicowanie a", null);
        saveProduct("Granola orzechowa stronicowanie b", null);
        saveProduct("Granola orzechowa stronicowanie c", null);

        mockMvc.perform(search("granola orzechowa stronicowanie").param("size", "2"))
                .andExpect(jsonPath("$.items", hasSize(2)))
                .andExpect(jsonPath("$.page").value(0))
                .andExpect(jsonPath("$.size").value(2))
                .andExpect(jsonPath("$.has_next").value(true));
        mockMvc.perform(search("granola orzechowa stronicowanie").param("size", "2").param("page", "1"))
                .andExpect(jsonPath("$.items", hasSize(1)))
                .andExpect(jsonPath("$.has_next").value(false));
    }

    @Test
    void showsSimilarMatchesAfterAllExactMatchesAcrossPages() throws Exception {
        Product first = saveProduct("Stracciatella lody", null);
        Product second = saveProduct("Stracciatella serek", null);
        Product similar = saveProduct("Straciatella jogurt", null);

        mockMvc.perform(search("stracciatella").param("size", "2"))
                .andExpect(jsonPath("$.items[*].id", contains(first.getId().toString(), second.getId().toString())))
                .andExpect(jsonPath("$.has_next").value(true));
        mockMvc.perform(search("stracciatella").param("size", "2").param("page", "1"))
                .andExpect(jsonPath("$.items[*].id", contains(similar.getId().toString())))
                .andExpect(jsonPath("$.has_next").value(false));
        mockMvc.perform(search("stracciatella").param("size", "1").param("page", "2"))
                .andExpect(jsonPath("$.items[*].id", contains(similar.getId().toString())));
        mockMvc.perform(search("stracciatella").param("size", "1").param("page", "3"))
                .andExpect(jsonPath("$.items", hasSize(0)));
    }

    @Test
    void limitsPageSizeAndRejectsNegativePages() throws Exception {
        mockMvc.perform(search("ser").param("size", "500").param("page", "-3"))
                .andExpect(jsonPath("$.size").value(50))
                .andExpect(jsonPath("$.page").value(0));
        mockMvc.perform(search("ser").param("size", "0"))
                .andExpect(jsonPath("$.size").value(1));
    }

    @Test
    void appliesNutritionFilters() throws Exception {
        Product light = saveProduct("Kisiel filtrowany lekki", null);
        Product heavy = saveProduct("Kisiel filtrowany ciezki", null);
        heavy.setKcal(400.0);
        heavy.setProtein(1.0);
        heavy.setFat(30.0);
        heavy.setCarbs(70.0);
        productRepository.save(heavy);

        for (String[] filter : new String[][]{
                {"max_kcal", "200"}, {"min_protein", "5"}, {"max_fat", "10"}, {"max_carbs", "20"}}) {
            mockMvc.perform(search("kisiel filtrowany").param(filter[0], filter[1]))
                    .andExpect(jsonPath("$.items[*].id", contains(light.getId().toString())));
        }
        mockMvc.perform(search("kisiel filtrowany"))
                .andExpect(jsonPath("$.items", hasSize(2)));
    }

    @Test
    void listsProductsAlphabeticallyWithoutAQuery() throws Exception {
        saveProduct("Aaa pierwszy alfabetycznie", null);

        mockMvc.perform(get("/api/products/search").param("size", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].name").value("Aaa pierwszy alfabetycznie"));
    }

    @Test
    void doesNotListTheWholeProductTable() throws Exception {
        mockMvc.perform(get("/api/products"))
                .andExpect(status().isMethodNotAllowed());
    }
}
