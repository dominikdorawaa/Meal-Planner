package com.mealplanner.server.off;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.Path;

@Component
@ConditionalOnProperty(name = OffImportRunner.FILE_PROPERTY)
@RequiredArgsConstructor
public class OffImportRunner implements CommandLineRunner {

    static final String FILE_PROPERTY = "off.import.file";

    private final OffImportService importService;

    @Value("${" + FILE_PROPERTY + "}")
    private String file;

    @Override
    public void run(String... args) throws IOException {
        System.out.print(importService.importReviewed(Path.of(file)).describe());
    }
}
