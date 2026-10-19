package com.mealplanner.server.recipe;

import com.mealplanner.server.handler.ApiException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.net.URI;
import java.time.Duration;

@Slf4j
@Component
public class SupabaseRecipeImageStorage implements RecipeImageStorage {

    static final String UPLOAD_UNAVAILABLE = "recipe.image-upload-unavailable";
    static final String UPLOAD_FAILED = "recipe.image-upload-failed";

    private final String baseUrl;
    private final String serviceRoleKey;
    private final String bucket;
    private final RestClient restClient;

    @Autowired
    public SupabaseRecipeImageStorage(@Value("${supabase.url:}") String baseUrl,
                                      @Value("${supabase.service-role-key:}") String serviceRoleKey,
                                      @Value("${supabase.storage.recipe-images-bucket:recipe-images}") String bucket) {
        this(baseUrl, serviceRoleKey, bucket, RestClient.builder().requestFactory(requestFactory()));
    }

    SupabaseRecipeImageStorage(String baseUrl, String serviceRoleKey, String bucket, RestClient.Builder builder) {
        this.baseUrl = baseUrl == null ? "" : baseUrl.trim().replaceAll("/+$", "");
        this.serviceRoleKey = serviceRoleKey == null ? "" : serviceRoleKey.trim();
        this.bucket = bucket;
        this.restClient = builder.build();
    }

    @Override
    public String store(String path, byte[] content, String contentType) {
        if (baseUrl.isEmpty() || serviceRoleKey.isEmpty()) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, UPLOAD_UNAVAILABLE);
        }
        try {
            restClient.post()
                    .uri(URI.create(baseUrl + "/storage/v1/object/" + bucket + "/" + path))
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + serviceRoleKey)
                    .header("apikey", serviceRoleKey)
                    .header("x-upsert", "false")
                    .header(HttpHeaders.CACHE_CONTROL, "max-age=31536000")
                    .contentType(MediaType.parseMediaType(contentType))
                    .body(content)
                    .retrieve()
                    .toBodilessEntity();
        } catch (RestClientException exception) {
            log.warn("Recipe image upload to Supabase Storage failed: {}", exception.getMessage());
            throw new ApiException(HttpStatus.BAD_GATEWAY, UPLOAD_FAILED);
        }
        return baseUrl + "/storage/v1/object/public/" + bucket + "/" + path;
    }

    private static SimpleClientHttpRequestFactory requestFactory() {
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(Duration.ofSeconds(5));
        requestFactory.setReadTimeout(Duration.ofSeconds(20));
        return requestFactory;
    }
}
