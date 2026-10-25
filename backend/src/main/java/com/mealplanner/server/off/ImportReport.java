package com.mealplanner.server.off;

import java.util.Locale;
import java.util.Map;

public record ImportReport(long read, long soldInPoland, long inserted, long updated, long unchanged,
                           long skipped, Map<String, Long> skippedByReason, long removed, long hiddenInUse,
                           long duplicates, long tableRows, long tableBytes) {

    public String describe() {
        StringBuilder text = new StringBuilder()
                .append("Rows read: ").append(read).append('\n')
                .append("Sold in Poland: ").append(soldInPoland).append('\n')
                .append("Inserted: ").append(inserted).append('\n')
                .append("Updated: ").append(updated).append('\n')
                .append("Unchanged: ").append(unchanged).append('\n')
                .append("Skipped: ").append(skipped).append(" (one product can have several reasons)").append('\n');
        skippedByReason.forEach((reason, count) -> text.append("  ").append(reason).append(": ").append(count).append('\n'));
        return text
                .append("Removed outdated: ").append(removed).append('\n')
                .append("Hidden because used in meals: ").append(hiddenInUse).append('\n')
                .append("Duplicates hidden in search: ").append(duplicates).append('\n')
                .append("Products in table: ").append(tableRows).append('\n')
                .append(String.format(Locale.ROOT, "Products table size: %.1f MB%n", tableBytes / 1_000_000.0))
                .toString();
    }
}
