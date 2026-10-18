package com.mealplanner.server.off;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.zip.GZIPInputStream;

final class OffDump {

    private static final int BUFFER_SIZE = 1 << 16;

    private OffDump() {
    }

    static BufferedReader open(Path dump) throws IOException {
        InputStream input = Files.newInputStream(dump);
        if (dump.getFileName().toString().endsWith(".gz")) {
            input = new GZIPInputStream(input, BUFFER_SIZE);
        }
        return new BufferedReader(new InputStreamReader(input, StandardCharsets.UTF_8), BUFFER_SIZE);
    }
}
