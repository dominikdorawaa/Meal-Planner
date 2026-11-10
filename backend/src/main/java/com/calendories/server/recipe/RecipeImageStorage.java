package com.calendories.server.recipe;

public interface RecipeImageStorage {

    String store(String path, byte[] content, String contentType);

    void delete(String url);
}
