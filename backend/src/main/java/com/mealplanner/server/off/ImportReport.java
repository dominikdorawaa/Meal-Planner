package com.mealplanner.server.off;

import java.util.Locale;
import java.util.Map;

public record ImportReport(long read, long soldInPoland, long inserted, long updated, long unchanged,
                           Map<String, Long> skippedByReason, long tableRows, long tableBytes) {

    public long skipped() {
        return skippedByReason.values().stream().mapToLong(Long::longValue).sum();
    }

    public String describe() {
        StringBuilder text = new StringBuilder()
                .append("Rows read: ").append(read).append('\n')
                .append("Sold in Poland: ").append(soldInPoland).append('\n')
                .append("Inserted: ").append(inserted).append('\n')
                .append("Updated: ").append(updated).append('\n')
                .append("Unchanged: ").append(unchanged).append('\n')
                .append("Skipped: ").append(skipped()).append('\n');
        skippedByReason.forEach((reason, count) -> text.append("  ").append(reason).append(": ").append(count).append('\n'));
        return text
                .append("Products in table: ").append(tableRows).append('\n')
                .append(String.format(Locale.ROOT, "Products table size: %.1f MB%n", tableBytes / 1_000_000.0))
                .toString();
    }
}
