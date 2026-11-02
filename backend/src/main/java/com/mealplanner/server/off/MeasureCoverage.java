package com.mealplanner.server.off;

public record MeasureCoverage(long products, long inMilliliters, long onlyBase, long withPackage, long withPiece,
                              long withOther) {

    public String describe() {
        return "Products from Open Food Facts: " + products + '\n'
                + "  in ml: " + inMilliliters + '\n'
                + "  only g or ml: " + onlyBase + '\n'
                + "  with package: " + withPackage + '\n'
                + "  with piece: " + withPiece + '\n'
                + "  with serving or other measure: " + withOther + '\n';
    }
}
