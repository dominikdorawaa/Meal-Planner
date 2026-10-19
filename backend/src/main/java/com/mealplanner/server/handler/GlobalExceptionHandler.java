package com.mealplanner.server.handler;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.MessageSource;
import org.springframework.context.i18n.LocaleContextHolder;
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
import org.springframework.web.multipart.MaxUploadSizeExceededException;

import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

@Slf4j
@RestControllerAdvice
@RequiredArgsConstructor
public class GlobalExceptionHandler {

    static final String VALIDATION_FAILED = "error.validation-failed";
    static final String BAD_REQUEST = "error.bad-request";
    static final String UNAUTHORIZED = "error.unauthorized";
    static final String FORBIDDEN = "error.forbidden";
    static final String NOT_FOUND = "error.not-found";
    static final String METHOD_NOT_ALLOWED = "error.method-not-allowed";
    static final String REQUEST_FAILED = "error.request-failed";
    static final String INTERNAL_ERROR = "error.internal";
    static final String PAYLOAD_TOO_LARGE = "error.payload-too-large";

    private final MessageSource messageSource;

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, String>> handleValidation(MethodArgumentNotValidException e) {
        String message = e.getBindingResult().getFieldErrors().stream()
                .map(FieldError::getDefaultMessage)
                .filter(Objects::nonNull)
                .sorted()
                .collect(Collectors.joining("; "));
        if (message.isEmpty()) {
            return error(HttpStatus.BAD_REQUEST, VALIDATION_FAILED);
        }
        return ResponseEntity.badRequest().body(Map.of("error", message));
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

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<Map<String, String>> handleMaxUploadSize(MaxUploadSizeExceededException e) {
        return error(HttpStatus.PAYLOAD_TOO_LARGE, PAYLOAD_TOO_LARGE);
    }

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<Map<String, String>> handleApiException(ApiException e) {
        return error(e.getStatus(), e.getMessageKey());
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
            HttpStatusCode status = errorResponse.getStatusCode();
            return error(status, clientErrorKey(status));
        }
        log.error("Unexpected error while handling request", e);
        return error(HttpStatus.INTERNAL_SERVER_ERROR, INTERNAL_ERROR);
    }

    private String clientErrorKey(HttpStatusCode status) {
        if (status.isSameCodeAs(HttpStatus.NOT_FOUND)) {
            return NOT_FOUND;
        }
        if (status.isSameCodeAs(HttpStatus.METHOD_NOT_ALLOWED)) {
            return METHOD_NOT_ALLOWED;
        }
        return REQUEST_FAILED;
    }

    private ResponseEntity<Map<String, String>> error(HttpStatusCode status, String messageKey) {
        String message = messageSource.getMessage(messageKey, null, messageKey, LocaleContextHolder.getLocale());
        return ResponseEntity.status(status).body(Map.of("error", message));
    }
}
