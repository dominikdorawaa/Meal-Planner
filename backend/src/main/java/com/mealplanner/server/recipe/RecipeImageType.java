package com.mealplanner.server.recipe;

import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Optional;

enum RecipeImageType {
    JPEG("image/jpeg", "jpg"),
    PNG("image/png", "png"),
    WEBP("image/webp", "webp");

    private static final byte[] PNG_SIGNATURE = {(byte) 0x89, 'P', 'N', 'G', '\r', '\n', 0x1A, '\n'};

    private final String contentType;
    private final String extension;

    RecipeImageType(String contentType, String extension) {
        this.contentType = contentType;
        this.extension = extension;
    }

    String contentType() {
        return contentType;
    }

    String extension() {
        return extension;
    }

    static Optional<RecipeImageType> detect(byte[] content) {
        if (content.length >= 3 && (content[0] & 0xFF) == 0xFF && (content[1] & 0xFF) == 0xD8 && (content[2] & 0xFF) == 0xFF) {
            return Optional.of(JPEG);
        }
        if (content.length >= PNG_SIGNATURE.length
                && Arrays.equals(Arrays.copyOf(content, PNG_SIGNATURE.length), PNG_SIGNATURE)) {
            return Optional.of(PNG);
        }
        if (content.length >= 12 && ascii(content, 0, 4).equals("RIFF") && ascii(content, 8, 4).equals("WEBP")) {
            return Optional.of(WEBP);
        }
        return Optional.empty();
    }

    private static String ascii(byte[] content, int offset, int length) {
        return new String(content, offset, length, StandardCharsets.US_ASCII);
    }
}
