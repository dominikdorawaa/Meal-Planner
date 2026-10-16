package com.mealplanner.server.off;

import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.io.ByteArrayOutputStream;
import java.io.PrintStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class OffImportRunnerTest {

    @Test
    void importsTheConfiguredFileAndPrintsTheReport() throws Exception {
        OffImportService service = mock(OffImportService.class);
        when(service.importReviewed(Path.of("reviewed.csv")))
                .thenReturn(new ImportReport(3, 2, 1, 0, 0, 1, 0, Map.of("KCAL_MISMATCH", 1L), 2_500_000));
        OffImportRunner runner = new OffImportRunner(service);
        ReflectionTestUtils.setField(runner, "file", "reviewed.csv");
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        PrintStream original = System.out;
        System.setOut(new PrintStream(output, true, StandardCharsets.UTF_8));
        try {
            runner.run();
        } finally {
            System.setOut(original);
        }

        assertThat(output.toString(StandardCharsets.UTF_8))
                .contains("Rows read: 3")
                .contains("Inserted: 1")
                .contains("  KCAL_MISMATCH: 1")
                .contains("Skipped, added by users: 0")
                .contains("Products table size: 2.5 MB");
    }
}
