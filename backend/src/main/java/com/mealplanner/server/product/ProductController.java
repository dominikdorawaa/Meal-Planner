package com.mealplanner.server.product;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/products")
@CrossOrigin(origins = "${corsAllowedOrigins}")
public class ProductController {

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private ProductService productService;

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

    @GetMapping("/{id}")
    public ResponseEntity<Product> getProductById(@PathVariable UUID id) {
        return productRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/barcode/{barCode}")
    public ResponseEntity<Product> getProductByBarCode(@PathVariable String barCode) {
        return productRepository.findByBarCodeAndStatusAndDeletedAtIsNull(barCode, ProductStatus.VERIFIED)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public Product createProduct(@RequestBody Product product, Authentication authentication) {
        return productService.create(product, authentication.getName());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteProduct(@PathVariable UUID id, Authentication authentication) {
        productService.delete(id, authentication.getName());
        return ResponseEntity.ok().build();
    }
}
