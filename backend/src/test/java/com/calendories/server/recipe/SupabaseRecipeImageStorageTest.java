package com.calendories.server.recipe;

import com.calendories.server.handler.ApiException;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class SupabaseRecipeImageStorageTest {

    private static final byte[] CONTENT = {1, 2, 3};
    private static final UUID OWNER = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private static final String OWNER_PHOTO = "https://project.supabase.example/storage/v1/object/public/recipe-images/"
            + OWNER + "/photo.jpg";

    @Test
    void uploadsTheFileWithTheServiceKeyAndReturnsItsPublicUrl() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        SupabaseRecipeImageStorage storage = new SupabaseRecipeImageStorage(
                "https://project.supabase.example/", "example-service-key", "recipe-images", builder);
        server.expect(requestTo("https://project.supabase.example/storage/v1/object/recipe-images/user/photo.jpg"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(header(HttpHeaders.AUTHORIZATION, "Bearer example-service-key"))
                .andExpect(header("apikey", "example-service-key"))
                .andExpect(header("x-upsert", "false"))
                .andExpect(header(HttpHeaders.CONTENT_TYPE, MediaType.IMAGE_JPEG_VALUE))
                .andExpect(content().bytes(CONTENT))
                .andRespond(withSuccess("{\"Key\":\"recipe-images/user/photo.jpg\"}", MediaType.APPLICATION_JSON));

        String url = storage.store("user/photo.jpg", CONTENT, MediaType.IMAGE_JPEG_VALUE);

        assertThat(url).isEqualTo("https://project.supabase.example/storage/v1/object/public/recipe-images/user/photo.jpg");
        server.verify();
    }

    @Test
    void reportsFailedUploads() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        SupabaseRecipeImageStorage storage = new SupabaseRecipeImageStorage(
                "https://project.supabase.example", "example-service-key", "recipe-images", builder);
        server.expect(requestTo("https://project.supabase.example/storage/v1/object/recipe-images/user/photo.jpg"))
                .andRespond(withStatus(HttpStatus.BAD_REQUEST));

        assertThatThrownBy(() -> storage.store("user/photo.jpg", CONTENT, MediaType.IMAGE_JPEG_VALUE))
                .isInstanceOfSatisfying(ApiException.class, exception -> {
                    assertThat(exception.getStatus()).isEqualTo(HttpStatus.BAD_GATEWAY);
                    assertThat(exception.getMessageKey()).isEqualTo(SupabaseRecipeImageStorage.UPLOAD_FAILED);
                });
    }

    @Test
    void isUnavailableWithoutConfiguration() {
        SupabaseRecipeImageStorage storage = new SupabaseRecipeImageStorage(" ", null, "recipe-images");

        assertThatThrownBy(() -> storage.store("user/photo.jpg", CONTENT, MediaType.IMAGE_JPEG_VALUE))
                .isInstanceOfSatisfying(ApiException.class, exception -> {
                    assertThat(exception.getStatus()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
                    assertThat(exception.getMessageKey()).isEqualTo(SupabaseRecipeImageStorage.UPLOAD_UNAVAILABLE);
                });
    }
    @Test
    void deletesFilesFromItsOwnBucket() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        SupabaseRecipeImageStorage storage = new SupabaseRecipeImageStorage(
                "https://project.supabase.example", "example-service-key", "recipe-images", builder);
        server.expect(requestTo("https://project.supabase.example/storage/v1/object/recipe-images/" + OWNER + "/photo.jpg"))
                .andExpect(method(HttpMethod.DELETE))
                .andExpect(header(HttpHeaders.AUTHORIZATION, "Bearer example-service-key"))
                .andExpect(header("apikey", "example-service-key"))
                .andRespond(withSuccess());

        storage.delete(OWNER_PHOTO, OWNER);

        server.verify();
    }

    @Test
    void ignoresFilesOutsideTheOwnerFolder() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        SupabaseRecipeImageStorage storage = new SupabaseRecipeImageStorage(
                "https://project.supabase.example", "example-service-key", "recipe-images", builder);

        storage.delete("https://cdn.example.com/photo.jpg", OWNER);
        storage.delete("https://project.supabase.example/storage/v1/object/public/recipe-images/other/photo.jpg", OWNER);
        storage.delete("https://project.supabase.example/storage/v1/object/public/recipe-images/" + OWNER + "/", OWNER);
        storage.delete(OWNER_PHOTO, null);
        storage.delete(null, OWNER);

        server.verify();
    }

    @Test
    void skipsDeletionWithoutConfiguration() {
        SupabaseRecipeImageStorage storage = new SupabaseRecipeImageStorage(" ", null, "recipe-images");

        storage.delete("/storage/v1/object/public/recipe-images/" + OWNER + "/photo.jpg", OWNER);
    }

    @Test
    void keepsGoingWhenDeletionFails() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        SupabaseRecipeImageStorage storage = new SupabaseRecipeImageStorage(
                "https://project.supabase.example", "example-service-key", "recipe-images", builder);
        server.expect(requestTo("https://project.supabase.example/storage/v1/object/recipe-images/" + OWNER + "/photo.jpg"))
                .andRespond(withStatus(HttpStatus.INTERNAL_SERVER_ERROR));

        storage.delete(OWNER_PHOTO, OWNER);

        server.verify();
    }
}
