package com.mealplanner.server.handler;

import lombok.Getter;
import org.springframework.http.HttpStatus;

@Getter
public class ApiException extends RuntimeException {

    private final HttpStatus status;
    private final String messageKey;

    public ApiException(HttpStatus status, String messageKey) {
        super(messageKey);
        this.status = status;
        this.messageKey = messageKey;
    }
}
