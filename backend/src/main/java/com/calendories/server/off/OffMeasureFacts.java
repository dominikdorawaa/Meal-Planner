package com.calendories.server.off;

import java.util.List;

public record OffMeasureFacts(Double productQuantity, String productQuantityUnit, String servingSize,
                              Double servingQuantity, String servingQuantityUnit, List<String> categories) {

    public static final OffMeasureFacts NONE = new OffMeasureFacts(null, "", "", null, "", List.of());
}
