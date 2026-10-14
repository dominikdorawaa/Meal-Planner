package com.mealplanner.server.handler;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.core.MethodParameter;
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

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class GlobalExceptionHandlerTest {

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        LocalValidatorFactoryBean validator = new LocalValidatorFactoryBean();
        validator.afterPropertiesSet();
        mockMvc = MockMvcBuilders.standaloneSetup(new TestController())
                .setControllerAdvice(new GlobalExceptionHandler())
                .setValidator(validator)
                .build();
    }

    @Test
    void returnsBadRequestWithFieldMessagesWhenBodyIsInvalid() throws Exception {
        mockMvc.perform(post("/test/body")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"\",\"code\":\"a\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Kod jest za krótki; Nazwa jest wymagana"));
    }

    @Test
    void returnsBadRequestWhenJsonIsMalformed() throws Exception {
        mockMvc.perform(post("/test/body")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value(GlobalExceptionHandler.BAD_REQUEST));
    }

    @Test
    void returnsBadRequestWhenParameterHasWrongType() throws Exception {
        mockMvc.perform(get("/test/number").param("n", "abc"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value(GlobalExceptionHandler.BAD_REQUEST));
    }

    @Test
    void returnsBadRequestWhenParameterIsMissing() throws Exception {
        mockMvc.perform(get("/test/number"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value(GlobalExceptionHandler.BAD_REQUEST));
    }

    @Test
    void returnsBadRequestWhenParameterConstraintFails() throws Exception {
        mockMvc.perform(get("/test/positive").param("n", "0"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value(GlobalExceptionHandler.VALIDATION_FAILED));
    }

    @Test
    void returnsUnauthorizedOnlyForAuthenticationErrors() throws Exception {
        mockMvc.perform(get("/test/unauthenticated"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value(GlobalExceptionHandler.UNAUTHORIZED));
    }

    @Test
    void returnsForbiddenWhenAccessIsDenied() throws Exception {
        mockMvc.perform(get("/test/forbidden"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error").value(GlobalExceptionHandler.FORBIDDEN));
    }

    @Test
    void returnsInternalServerErrorWhenExceptionHasNoMessage() throws Exception {
        mockMvc.perform(get("/test/null-message"))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.error").value(GlobalExceptionHandler.INTERNAL_ERROR));
    }

    @Test
    void doesNotLeakMessageOfUnexpectedException() throws Exception {
        mockMvc.perform(get("/test/runtime"))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.error").value(GlobalExceptionHandler.INTERNAL_ERROR));
    }

    @Test
    void keepsClientErrorStatusOfSpringExceptions() throws Exception {
        mockMvc.perform(get("/test/not-found"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("Nie znaleziono"));
    }

    @Test
    void usesFallbackMessageWhenClientErrorHasNoDetail() throws Exception {
        mockMvc.perform(get("/test/conflict"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").value(GlobalExceptionHandler.REQUEST_FAILED));
    }

    @Test
    void returnsMethodNotAllowedForUnsupportedMethod() throws Exception {
        mockMvc.perform(post("/test/runtime"))
                .andExpect(status().isMethodNotAllowed());
    }

    @Test
    void treatsServerErrorStatusExceptionsAsInternalErrors() throws Exception {
        mockMvc.perform(get("/test/unavailable"))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.error").value(GlobalExceptionHandler.INTERNAL_ERROR));
    }

    @Test
    void usesGenericValidationMessageWhenFieldErrorsHaveNoMessage() throws Exception {
        BeanPropertyBindingResult bindingResult = new BeanPropertyBindingResult(new TestBody(), "body");
        bindingResult.rejectValue("name", "NotBlank");
        MethodParameter parameter = new MethodParameter(
                TestController.class.getMethod("body", TestBody.class), 0);

        ResponseEntity<Map<String, String>> response = new GlobalExceptionHandler()
                .handleValidation(new MethodArgumentNotValidException(parameter, bindingResult));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody()).containsEntry("error", GlobalExceptionHandler.VALIDATION_FAILED);
    }

    static class TestBody {
        @NotBlank(message = "Nazwa jest wymagana")
        private String name;

        @Size(min = 3, message = "Kod jest za krótki")
        private String code;

        public String getName() {
            return name;
        }

        public void setName(String name) {
            this.name = name;
        }

        public String getCode() {
            return code;
        }

        public void setCode(String code) {
            this.code = code;
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
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Nie znaleziono");
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
