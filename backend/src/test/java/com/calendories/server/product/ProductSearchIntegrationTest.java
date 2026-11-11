package com.calendories.server.product;

import com.calendories.server.TestcontainersConfiguration;
import com.calendories.server.auth.JwtService;
import com.calendories.server.user.User;
import com.calendories.server.user.UserRepository;
import com.calendories.server.user.UserRole;
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

    private Product saveBasicProduct(String name) {
        Product product = saveProduct(name, null);
        product.setBarCode(null);
        product.setSource(ProductSource.BASIC);
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
        Product inside = saveProduct("Napoj agrestowy nieslodzony", null);
        Product prefix = saveProduct("Agrestowy jogurt roslinny", null);

        mockMvc.perform(search("agrestowy"))
                .andExpect(jsonPath("$.items[0].id").value(prefix.getId().toString()))
                .andExpect(jsonPath("$.items[1].id").value(inside.getId().toString()));
    }

    @Test
    void ranksBasicProductsAboveOpenFoodFactsProductsWithSimilarNames() throws Exception {
        Product openFoodFacts = saveProduct("Jagody kamczackie bio", null);
        openFoodFacts.setSource(ProductSource.OPEN_FOOD_FACTS);
        productRepository.save(openFoodFacts);
        Product basic = saveBasicProduct("Jagody kamczackie swieze");

        mockMvc.perform(search("jagody kamczackie"))
                .andExpect(jsonPath("$.items[*].id", contains(basic.getId().toString(), openFoodFacts.getId().toString())));
        mockMvc.perform(search("jagody kamczacke"))
                .andExpect(jsonPath("$.items[*].id", contains(basic.getId().toString(), openFoodFacts.getId().toString())));
    }

    @Test
    void keepsNamesStartingWithTheQueryAboveBasicProducts() throws Exception {
        Product prefix = saveProduct("Pigwowiec owoce bio", null);
        Product basic = saveBasicProduct("Suszony pigwowiec owoce");

        mockMvc.perform(search("pigwowiec owoce"))
                .andExpect(jsonPath("$.items[*].id", contains(prefix.getId().toString(), basic.getId().toString())));
    }

    @Test
    void findsBasicProductsWithTheirMeasures() throws Exception {
        mockMvc.perform(search("banan"))
                .andExpect(jsonPath("$.items[0].name").value("Banan"))
                .andExpect(jsonPath("$.items[0].source").value("BASIC"))
                .andExpect(jsonPath("$.items[0].measures[*].code", contains("piece", "g")))
                .andExpect(jsonPath("$.items[0].measures[*].base_amount", contains(120.0, 1.0)));
        mockMvc.perform(search("truskawki"))
                .andExpect(jsonPath("$.items[0].name").value("Truskawki"))
                .andExpect(jsonPath("$.items[0].measures[*].code", contains("g", "piece", "cup")))
                .andExpect(jsonPath("$.items[0].measures[*].base_amount", contains(1.0, 12.0, 150.0)));
        mockMvc.perform(search("mleko 3,2%"))
                .andExpect(jsonPath("$.items[0].name").value("Mleko 3,2%"))
                .andExpect(jsonPath("$.items[0].unit").value("100ml"))
                .andExpect(jsonPath("$.items[0].measures[*].code", contains("ml", "cup", "package", "mug")))
                .andExpect(jsonPath("$.items[0].measures[*].base_amount", contains(1.0, 250.0, 1000.0, 300.0)));
    }

    @Test
    void findsKitchenBasicsWithTheirKitchenMeasures() throws Exception {
        Product openFoodFacts = saveProduct("Czosnek", "Example Farm");
        openFoodFacts.setSource(ProductSource.OPEN_FOOD_FACTS);
        productRepository.save(openFoodFacts);

        mockMvc.perform(search("czosnek"))
                .andExpect(jsonPath("$.items[0].source").value("BASIC"))
                .andExpect(jsonPath("$.items[0].name").value("Czosnek"))
                .andExpect(jsonPath("$.items[0].measures[0].code").value("clove"))
                .andExpect(jsonPath("$.items[0].measures[0].names.pl.one").value("ząbek"));
        mockMvc.perform(search("limonka"))
                .andExpect(jsonPath("$.items[0].name").value("Limonka"));
        mockMvc.perform(search("pieprz"))
                .andExpect(jsonPath("$.items[0].name").value("Pieprz czarny mielony"))
                .andExpect(jsonPath("$.items[0].generic_measures[*].code", contains("pinch")));
        mockMvc.perform(search("proszek do pieczenia"))
                .andExpect(jsonPath("$.items[0].name").value("Proszek do pieczenia"))
                .andExpect(jsonPath("$.items[0].measures[*].code", hasItem("tsp")));
        mockMvc.perform(search("mleko 3,2%"))
                .andExpect(jsonPath("$.items[0].generic_measures[*].code", hasItem("tbsp")));
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
    void returnsAnEmptyPageForVeryLargePageNumbers() throws Exception {
        mockMvc.perform(search("ser").param("size", "20").param("page", "107374183"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items", hasSize(0)))
                .andExpect(jsonPath("$.has_next").value(false));
        mockMvc.perform(search("").param("size", "50").param("page", String.valueOf(Integer.MAX_VALUE)))
                .andExpect(status().isOk())
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
    void sortsEquallyRankedNamesWithPunctuationDigitsAndMixedCaseInPolishOrder() throws Exception {
        Product naturalny = saveProduct("Kolejnosc naturalny", null);
        Product percent = saveProduct("kolejnosc 2,2%", null);
        Product zero = saveProduct("Kolejnosc 0%", null);
        Product musli = saveProduct("Kolejnosc + Musli", null);
        Product truskawka = saveProduct("Kolejnosc - truskawka", null);

        mockMvc.perform(search("kolejnosc"))
                .andExpect(jsonPath("$.items[*].id", contains(truskawka.getId().toString(), musli.getId().toString(),
                        zero.getId().toString(), percent.getId().toString(), naturalny.getId().toString())));
    }

    @Test
    void sortsEquallyRankedNamesWithPolishLettersInPolishOrder() throws Exception {
        Product zurek = saveProduct("Żurek porzadkowy", null);
        Product zupa = saveProduct("Zupa porzadkowa", null);
        Product sledz = saveProduct("Śledź porzadkowy", null);
        Product sznycel = saveProduct("Sznycel porzadkowy", null);
        Product dzem = saveProduct("Dżem porzadkowy", null);
        Product cwikla = saveProduct("Ćwikła porzadkowa", null);

        mockMvc.perform(search("porzadkow"))
                .andExpect(jsonPath("$.items[*].id", contains(cwikla.getId().toString(), dzem.getId().toString(),
                        sznycel.getId().toString(), sledz.getId().toString(), zupa.getId().toString(),
                        zurek.getId().toString())));
    }

    @Test
    void sortsSimilarMatchesWithTheSameScoreInPolishOrder() throws Exception {
        Product dzem = saveProduct("Dżem marynowany", null);
        Product cwikla = saveProduct("Ćwikła marynowany", null);

        mockMvc.perform(search("marynowny"))
                .andExpect(jsonPath("$.items[*].id", contains(cwikla.getId().toString(), dzem.getId().toString())));
    }

    @Test
    void listsProductsWithoutAQueryInPolishOrder() throws Exception {
        Product zurek = saveProduct("Żurek listowany", null);
        Product zupa = saveProduct("Zupa listowana", null);
        Product sledz = saveProduct("Śledź listowany", null);
        Product sznycel = saveProduct("sznycel listowany", null);
        for (Product product : new Product[]{zurek, zupa, sledz, sznycel}) {
            product.setProtein(987.0);
            productRepository.save(product);
        }

        mockMvc.perform(get("/api/products/search").param("min_protein", "986"))
                .andExpect(jsonPath("$.items[*].id", contains(sznycel.getId().toString(), sledz.getId().toString(),
                        zupa.getId().toString(), zurek.getId().toString())));
    }

    @Test
    void doesNotListTheWholeProductTable() throws Exception {
        mockMvc.perform(get("/api/products"))
                .andExpect(status().isMethodNotAllowed());
    }
}
