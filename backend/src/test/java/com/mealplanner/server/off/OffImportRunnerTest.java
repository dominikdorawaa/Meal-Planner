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
        when(service.importDump(Path.of("dump.jsonl.gz")))
                .thenReturn(new ImportReport(3, 2, 1, 0, 0, 1, Map.of("KCAL_LOOKS_LIKE_KJ", 1L), 4, 1, 2, 40, 2_500_000));
        OffImportRunner runner = new OffImportRunner(service);
        ReflectionTestUtils.setField(runner, "file", "dump.jsonl.gz");
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
                .contains("Sold in Poland: 2")
                .contains("Skipped: 1")
                .contains("  KCAL_LOOKS_LIKE_KJ: 1")
                .contains("Removed outdated: 4")
                .contains("Hidden because used in meals: 1")
                .contains("Duplicates hidden in search: 2")
                .contains("Products in table: 40")
                .contains("Products table size: 2.5 MB");
    }
}
