package com.mealplanner.server.off;

import com.mealplanner.server.product.Product;

public record OffLookupResult(Product product, OffProduct prefill) {

    public static OffLookupResult found(Product product) {
        return new OffLookupResult(product, null);
    }

    public static OffLookupResult incomplete(OffProduct prefill) {
        return new OffLookupResult(null, prefill);
    }

    public static OffLookupResult missing() {
        return new OffLookupResult(null, null);
    }
}
