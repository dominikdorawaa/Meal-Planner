package com.mealplanner.server.off;

import java.util.Locale;
import java.util.Map;

public record ImportReport(long read, long selected, long inserted, long updated, long unchanged,
                           long skippedInvalid, long skippedProtected, Map<String, Long> invalidByReason,
                           long tableBytes) {

    public String describe() {
        StringBuilder text = new StringBuilder()
                .append("Rows read: ").append(read).append('\n')
                .append("Selected for import: ").append(selected).append('\n')
                .append("Inserted: ").append(inserted).append('\n')
                .append("Updated: ").append(updated).append('\n')
                .append("Unchanged: ").append(unchanged).append('\n')
                .append("Skipped, invalid: ").append(skippedInvalid).append('\n');
        invalidByReason.forEach((reason, count) -> text.append("  ").append(reason).append(": ").append(count).append('\n'));
        return text
                .append("Skipped, added by users: ").append(skippedProtected).append('\n')
                .append(String.format(Locale.ROOT, "Products table size: %.1f MB%n", tableBytes / 1_000_000.0))
                .toString();
    }
}
