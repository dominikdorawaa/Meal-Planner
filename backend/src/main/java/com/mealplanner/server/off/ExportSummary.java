package com.mealplanner.server.off;

import java.util.Locale;
import java.util.Map;

public record ExportSummary(long polishProducts, long accepted, long rejected, long skippedLines,
                            Map<String, Long> rejectedByReason) {

    static final long ESTIMATED_BYTES_PER_PRODUCT = 700;

    public long estimatedTableBytes() {
        return accepted * ESTIMATED_BYTES_PER_PRODUCT;
    }

    public String describe() {
        StringBuilder text = new StringBuilder()
                .append("Polish products: ").append(polishProducts).append('\n')
                .append("Accepted: ").append(accepted).append('\n')
                .append("Rejected: ").append(rejected).append('\n');
        rejectedByReason.forEach((reason, count) -> text.append("  ").append(reason).append(": ").append(count).append('\n'));
        return text
                .append("Skipped lines: ").append(skippedLines).append('\n')
                .append(String.format(Locale.ROOT, "Estimated table size: %.1f MB (%d B per product with indexes)%n",
                        estimatedTableBytes() / 1_000_000.0, ESTIMATED_BYTES_PER_PRODUCT))
                .toString();
    }
}
