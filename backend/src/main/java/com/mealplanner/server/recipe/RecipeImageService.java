package com.mealplanner.server.recipe;

import com.mealplanner.server.handler.ApiException;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class RecipeImageService {

    static final long MAX_SIZE_BYTES = 5L * 1024 * 1024;
    static final String IMAGE_MISSING = "recipe.image-missing";
    static final String IMAGE_TOO_LARGE = "recipe.image-too-large";
    static final String IMAGE_UNSUPPORTED = "recipe.image-unsupported";

    private final RecipeService recipeService;
    private final RecipeImageStorage storage;

    public String upload(MultipartFile file, String email) {
        UUID userId = recipeService.requireUser(email).getId();
        if (file == null || file.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, IMAGE_MISSING);
        }
        if (file.getSize() > MAX_SIZE_BYTES) {
            throw new ApiException(HttpStatus.PAYLOAD_TOO_LARGE, IMAGE_TOO_LARGE);
        }
        byte[] content = read(file);
        RecipeImageType type = RecipeImageType.detect(content)
                .orElseThrow(() -> new ApiException(HttpStatus.UNSUPPORTED_MEDIA_TYPE, IMAGE_UNSUPPORTED));
        String path = userId + "/" + UUID.randomUUID() + "." + type.extension();
        return storage.store(path, content, type.contentType());
    }

    private static byte[] read(MultipartFile file) {
        try {
            return file.getBytes();
        } catch (IOException exception) {
            throw new ApiException(HttpStatus.BAD_REQUEST, IMAGE_MISSING);
        }
    }
}
