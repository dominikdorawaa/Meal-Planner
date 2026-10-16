package com.mealplanner.server.off;

public class OffUnavailableException extends RuntimeException {

    public OffUnavailableException(Throwable cause) {
        super("Open Food Facts is unavailable", cause);
    }
}
