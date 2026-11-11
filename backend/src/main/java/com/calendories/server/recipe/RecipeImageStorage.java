package com.calendories.server.recipe;

import java.util.UUID;

public interface RecipeImageStorage {

    String store(String path, byte[] content, String contentType);

    void delete(String url, UUID ownerId);
}
