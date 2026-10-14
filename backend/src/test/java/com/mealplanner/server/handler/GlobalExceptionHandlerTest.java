package com.mealplanner.server.handler;

import com.mealplanner.server.config.LocaleConfig;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.context.i18n.LocaleContextHolder;
import org.springframework.context.support.ResourceBundleMessageSource;
import org.springframework.core.MethodParameter;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.validation.BeanPropertyBindingResult;
import org.springframework.validation.beanvalidation.LocalValidatorFactoryBean;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.Map;
import java.util.Properties;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class GlobalExceptionHandlerTest {

    private static final Locale POLISH = LocaleConfig.DEFAULT_LOCALE;

    private ResourceBundleMessageSource messageSource;
    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        messageSource = new ResourceBundleMessageSource();
        messageSource.setBasename("messages");
        messageSource.setDefaultEncoding("UTF-8");
        messageSource.setFallbackToSystemLocale(false);
        LocalValidatorFactoryBean validator = new LocalValidatorFactoryBean();
        validator.setValidationMessageSource(messageSource);
        validator.afterPropertiesSet();
        mockMvc = MockMvcBuilders.standaloneSetup(new TestController())
                .setControllerAdvice(new GlobalExceptionHandler(messageSource))
                .setValidator(validator)
                .setLocaleResolver(new LocaleConfig().localeResolver())
                .build();
    }

    private String message(String key, Locale locale) {
        return messageSource.getMessage(key, null, locale);
    }

    private String fieldMessages(Locale locale) {
        return Stream.of(
                        message("validation.name.required", locale),
                        message("validation.password.too-short", locale).replace("{min}", "6"))
                .sorted()
                .collect(Collectors.joining("; "));
    }

    @Test
    void returnsPolishFieldMessagesByDefault() throws Exception {
        mockMvc.perform(post("/test/body")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"\",\"password\":\"abc\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value(fieldMessages(POLISH)));
    }

    @Test
    void returnsEnglishFieldMessagesWhenRequested() throws Exception {
        mockMvc.perform(post("/test/body")
                        .header(HttpHeaders.ACCEPT_LANGUAGE, "en-US")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"\",\"password\":\"abc\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value(fieldMessages(Locale.ENGLISH)))
                .andExpect(jsonPath("$.error").value("Name is required; Password must be at least 6 characters long"));
    }

    @Test
    void fallsBackToPolishForUnsupportedLanguage() throws Exception {
        mockMvc.perform(get("/test/runtime").header(HttpHeaders.ACCEPT_LANGUAGE, "de"))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.error").value(message(GlobalExceptionHandler.INTERNAL_ERROR, POLISH)));
    }

    @Test
    void returnsBadRequestWhenJsonIsMalformed() throws Exception {
        mockMvc.perform(post("/test/body")
                        .header(HttpHeaders.ACCEPT_LANGUAGE, "en")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Malformed request."));
    }

    @Test
    void returnsBadRequestWhenParameterHasWrongType() throws Exception {
        mockMvc.perform(get("/test/number").param("n", "abc"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value(message(GlobalExceptionHandler.BAD_REQUEST, POLISH)));
    }

    @Test
    void returnsBadRequestWhenParameterIsMissing() throws Exception {
        mockMvc.perform(get("/test/number"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value(message(GlobalExceptionHandler.BAD_REQUEST, POLISH)));
    }

    @Test
    void returnsBadRequestWhenParameterConstraintFails() throws Exception {
        mockMvc.perform(get("/test/positive").param("n", "0"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value(message(GlobalExceptionHandler.VALIDATION_FAILED, POLISH)));
    }

    @Test
    void returnsStatusAndTranslatedMessageOfApiException() throws Exception {
        mockMvc.perform(get("/test/api-exception").header(HttpHeaders.ACCEPT_LANGUAGE, "en"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("Invalid email or password."));
    }

    @Test
    void returnsUnauthorizedOnlyForAuthenticationErrors() throws Exception {
        mockMvc.perform(get("/test/unauthenticated"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value(message(GlobalExceptionHandler.UNAUTHORIZED, POLISH)));
    }

    @Test
    void returnsForbiddenWhenAccessIsDenied() throws Exception {
        mockMvc.perform(get("/test/forbidden"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error").value(message(GlobalExceptionHandler.FORBIDDEN, POLISH)));
    }

    @Test
    void returnsInternalServerErrorWhenExceptionHasNoMessage() throws Exception {
        mockMvc.perform(get("/test/null-message"))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.error").value(message(GlobalExceptionHandler.INTERNAL_ERROR, POLISH)));
    }

    @Test
    void doesNotLeakMessageOfUnexpectedException() throws Exception {
        mockMvc.perform(get("/test/runtime").header(HttpHeaders.ACCEPT_LANGUAGE, "en"))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.error").value("Internal server error."));
    }

    @Test
    void translatesNotFoundStatus() throws Exception {
        mockMvc.perform(get("/test/not-found"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value(message(GlobalExceptionHandler.NOT_FOUND, POLISH)));
    }

    @Test
    void usesGenericMessageForOtherClientErrors() throws Exception {
        mockMvc.perform(get("/test/conflict"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").value(message(GlobalExceptionHandler.REQUEST_FAILED, POLISH)));
    }

    @Test
    void translatesMethodNotAllowedStatus() throws Exception {
        mockMvc.perform(post("/test/runtime"))
                .andExpect(status().isMethodNotAllowed())
                .andExpect(jsonPath("$.error").value(message(GlobalExceptionHandler.METHOD_NOT_ALLOWED, POLISH)));
    }

    @Test
    void treatsServerErrorStatusExceptionsAsInternalErrors() throws Exception {
        mockMvc.perform(get("/test/unavailable"))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.error").value(message(GlobalExceptionHandler.INTERNAL_ERROR, POLISH)));
    }

    @Test
    void usesGenericValidationMessageWhenFieldErrorsHaveNoMessage() throws Exception {
        BeanPropertyBindingResult bindingResult = new BeanPropertyBindingResult(new TestBody(), "body");
        bindingResult.rejectValue("name", "NotBlank");
        MethodParameter parameter = new MethodParameter(
                TestController.class.getMethod("body", TestBody.class), 0);
        LocaleContextHolder.setLocale(Locale.ENGLISH);
        try {
            ResponseEntity<Map<String, String>> response = new GlobalExceptionHandler(messageSource)
                    .handleValidation(new MethodArgumentNotValidException(parameter, bindingResult));

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
            assertThat(response.getBody()).containsEntry("error", "Request data is invalid.");
        } finally {
            LocaleContextHolder.resetLocaleContext();
        }
    }

    @Test
    void polishAndEnglishMessageFilesDefineTheSameKeys() throws Exception {
        Properties polish = new Properties();
        Properties english = new Properties();
        try (InputStream pl = getClass().getResourceAsStream("/messages.properties");
             InputStream en = getClass().getResourceAsStream("/messages_en.properties")) {
            polish.load(new InputStreamReader(pl, StandardCharsets.UTF_8));
            english.load(new InputStreamReader(en, StandardCharsets.UTF_8));
        }

        assertThat(polish.stringPropertyNames()).isNotEmpty();
        assertThat(english.stringPropertyNames()).isEqualTo(polish.stringPropertyNames());
    }

    static class TestBody {
        @NotBlank(message = "{validation.name.required}")
        private String name;

        @Size(min = 6, message = "{validation.password.too-short}")
        private String password;

        public String getName() {
            return name;
        }

        public void setName(String name) {
            this.name = name;
        }

        public String getPassword() {
            return password;
        }

        public void setPassword(String password) {
            this.password = password;
        }
    }

    @RestController
    static class TestController {

        @PostMapping("/test/body")
        public String body(@Valid @RequestBody TestBody body) {
            return "ok";
        }

        @GetMapping("/test/number")
        public int number(@RequestParam int n) {
            return n;
        }

        @GetMapping("/test/positive")
        public int positive(@RequestParam @Min(1) int n) {
            return n;
        }

        @GetMapping("/test/api-exception")
        public String apiException() {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "auth.invalid-credentials");
        }

        @GetMapping("/test/unauthenticated")
        public String unauthenticated() {
            throw new BadCredentialsException("bad token");
        }

        @GetMapping("/test/forbidden")
        public String forbidden() {
            throw new AccessDeniedException("denied");
        }

        @GetMapping("/test/null-message")
        public String nullMessage() {
            throw new IllegalStateException();
        }

        @GetMapping("/test/runtime")
        public String runtime() {
            throw new RuntimeException("secret internal details");
        }

        @GetMapping("/test/not-found")
        public String notFound() {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "missing");
        }

        @GetMapping("/test/conflict")
        public String conflict() {
            throw new ResponseStatusException(HttpStatus.CONFLICT);
        }

        @GetMapping("/test/unavailable")
        public String unavailable() {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "down");
        }
    }
}
