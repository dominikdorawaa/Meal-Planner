package com.mealplanner.server.product;

public record ExtraNutrients(Double saturatedFat, Double sugars, Double fiber, Double salt) {

    public static final ExtraNutrients NONE = new ExtraNutrients(null, null, null, null);

    public static ExtraNutrients of(Product product) {
        return new ExtraNutrients(product.getSaturatedFat(), product.getSugars(), product.getFiber(),
                product.getSalt());
    }

    public ExtraNutrients rounded() {
        return new ExtraNutrients(NutritionRounding.grams(saturatedFat), NutritionRounding.grams(sugars),
                NutritionRounding.grams(fiber), NutritionRounding.grams(salt));
    }

    public ExtraNutrients plausibleFor(Double fat, Double carbs) {
        return new ExtraNutrients(atMost(plausible(saturatedFat), fat), atMost(plausible(sugars), carbs),
                plausible(fiber), plausible(salt));
    }

    public void applyTo(Product product) {
        product.setSaturatedFat(saturatedFat);
        product.setSugars(sugars);
        product.setFiber(fiber);
        product.setSalt(salt);
    }

    private static Double plausible(Double grams) {
        return grams == null || grams < 0 || grams > NutritionValidator.MAX_GRAMS_PER_100G ? null : grams;
    }

    private static Double atMost(Double part, Double whole) {
        return part != null && whole != null && part > whole ? null : part;
    }
}
