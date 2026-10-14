package com.mealplanner.server.handler;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.validation.FieldError;
import org.springframework.web.ErrorResponse;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    static final String VALIDATION_FAILED = "Dane nie spełniają wymagań.";
    static final String BAD_REQUEST = "Nieprawidłowe żądanie.";
    static final String UNAUTHORIZED = "Brak autoryzacji.";
    static final String FORBIDDEN = "Brak dostępu.";
    static final String REQUEST_FAILED = "Nie udało się obsłużyć żądania.";
    static final String INTERNAL_ERROR = "Wewnętrzny błąd serwera.";

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, String>> handleValidation(MethodArgumentNotValidException e) {
        String message = e.getBindingResult().getFieldErrors().stream()
                .map(FieldError::getDefaultMessage)
                .filter(Objects::nonNull)
                .sorted()
                .collect(Collectors.joining("; "));
        return error(HttpStatus.BAD_REQUEST, message.isEmpty() ? VALIDATION_FAILED : message);
    }

    @ExceptionHandler(HandlerMethodValidationException.class)
    public ResponseEntity<Map<String, String>> handleMethodValidation(HandlerMethodValidationException e) {
        return error(HttpStatus.BAD_REQUEST, VALIDATION_FAILED);
    }

    @ExceptionHandler({
            HttpMessageNotReadableException.class,
            MethodArgumentTypeMismatchException.class,
            MissingServletRequestParameterException.class
    })
    public ResponseEntity<Map<String, String>> handleBadRequest(Exception e) {
        return error(HttpStatus.BAD_REQUEST, BAD_REQUEST);
    }

    @ExceptionHandler(AuthenticationException.class)
    public ResponseEntity<Map<String, String>> handleAuthentication(AuthenticationException e) {
        return error(HttpStatus.UNAUTHORIZED, UNAUTHORIZED);
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<Map<String, String>> handleAccessDenied(AccessDeniedException e) {
        return error(HttpStatus.FORBIDDEN, FORBIDDEN);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, String>> handleException(Exception e) {
        if (e instanceof ErrorResponse errorResponse && errorResponse.getStatusCode().is4xxClientError()) {
            String detail = errorResponse.getBody().getDetail();
            return error(errorResponse.getStatusCode(), detail != null ? detail : REQUEST_FAILED);
        }
        log.error("Unexpected error while handling request", e);
        return error(HttpStatus.INTERNAL_SERVER_ERROR, INTERNAL_ERROR);
    }

    private ResponseEntity<Map<String, String>> error(HttpStatusCode status, String message) {
        return ResponseEntity.status(status).body(Map.of("error", message));
    }
}
