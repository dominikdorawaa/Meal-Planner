package com.mealplanner.server.product;

import com.mealplanner.server.off.OffLookupResult;
import com.mealplanner.server.off.OffLookupService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.MessageSource;
import org.springframework.context.i18n.LocaleContextHolder;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@RestController
@RequestMapping("/api/products")
@CrossOrigin(origins = "${corsAllowedOrigins}")
public class ProductController {

    static final String NOT_FOUND_BY_BAR_CODE = "product.not-found-by-bar-code";

    @Autowired
    private ProductService productService;

    @Autowired
    private OffLookupService offLookupService;

    @Autowired
    private MessageSource messageSource;

    @GetMapping("/search")
    public ProductPage searchProducts(@RequestParam(name = "q", defaultValue = "") String query,
                                      @RequestParam(defaultValue = "0") int page,
                                      @RequestParam(defaultValue = "20") int size,
                                      @RequestParam(name = "max_kcal", required = false) Double maxKcal,
                                      @RequestParam(name = "min_protein", required = false) Double minProtein,
                                      @RequestParam(name = "max_fat", required = false) Double maxFat,
                                      @RequestParam(name = "max_carbs", required = false) Double maxCarbs,
                                      Authentication authentication) {
        String email = authentication == null ? null : authentication.getName();
        ProductFilters filters = new ProductFilters(maxKcal, minProtein, maxFat, maxCarbs);
        return productService.search(query, filters, page, size, email);
    }

    @GetMapping("/saved")
    public List<Product> getSavedProducts(Authentication authentication) {
        return productService.savedProducts(authentication.getName());
    }

    @GetMapping("/own")
    public List<Product> getOwnProducts(Authentication authentication) {
        return productService.ownProducts(authentication.getName());
    }

    @GetMapping("/{id}")
    public ResponseEntity<Product> getProductById(@PathVariable UUID id, Authentication authentication) {
        String email = authentication == null ? null : authentication.getName();
        return productService.findVisible(id, email)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/barcode/{barCode}")
    public ResponseEntity<?> getProductByBarCode(@PathVariable String barCode, Authentication authentication) {
        String email = authentication == null ? null : authentication.getName();
        Optional<Product> local = productService.findByBarCode(barCode, email);
        if (local.isPresent()) {
            return ResponseEntity.ok(local.get());
        }
        OffLookupResult result = offLookupService.lookup(barCode);
        if (result.product() != null) {
            return ResponseEntity.ok(result.product());
        }
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("error", messageSource.getMessage(NOT_FOUND_BY_BAR_CODE, null, LocaleContextHolder.getLocale()));
        if (result.prefill() != null) {
            body.put("prefill", ProductPrefill.from(result.prefill()));
        }
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(body);
    }

    @GetMapping("/barcode/{barCode}/existing")
    public ResponseEntity<Product> getExistingProductByBarCode(@PathVariable String barCode, Authentication authentication) {
        String email = authentication == null ? null : authentication.getName();
        return productService.findByBarCode(barCode, email)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public Product createProduct(@RequestBody Product product, Authentication authentication) {
        return productService.create(product, authentication.getName());
    }

    @PutMapping("/{id}")
    public Product updateProduct(@PathVariable UUID id, @RequestBody Product product, Authentication authentication) {
        return productService.update(id, product, authentication.getName());
    }

    @PostMapping("/{id}/own-version")
    public Product createOwnVersion(@PathVariable UUID id, @RequestBody(required = false) Product product,
                                    Authentication authentication) {
        return productService.createOwnVersion(id, product, authentication.getName());
    }

    @PostMapping("/{id}/saved")
    public ResponseEntity<Void> saveProduct(@PathVariable UUID id, Authentication authentication) {
        productService.save(id, authentication.getName());
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{id}/saved")
    public ResponseEntity<Void> unsaveProduct(@PathVariable UUID id, Authentication authentication) {
        productService.unsave(id, authentication.getName());
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteProduct(@PathVariable UUID id, Authentication authentication) {
        productService.delete(id, authentication.getName());
        return ResponseEntity.ok().build();
    }
}
