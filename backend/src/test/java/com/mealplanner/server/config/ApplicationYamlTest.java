package com.mealplanner.server.config;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.config.YamlPropertiesFactoryBean;
import org.springframework.core.env.MapPropertySource;
import org.springframework.core.env.PropertiesPropertySource;
import org.springframework.core.env.StandardEnvironment;
import org.springframework.core.io.ClassPathResource;

import java.util.Map;
import java.util.Properties;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ApplicationYamlTest {

    private Properties loadApplicationYaml() {
        YamlPropertiesFactoryBean factory = new YamlPropertiesFactoryBean();
        factory.setResources(new ClassPathResource("application.yml"));
        return factory.getObject();
    }

    @Test
    void applicationPropertiesFileIsNoLongerOnClasspath() {
        assertThat(new ClassPathResource("application.properties").exists()).isFalse();
    }

    @Test
    void exposesPropertiesReadByTheApplicationCode() {
        Properties props = loadApplicationYaml();

        assertThat(props.getProperty("jwt.secret")).isEqualTo("${JWT_SECRET}");
        assertThat(props.getProperty("jwt.expiration-ms")).isEqualTo("${JWT_EXPIRATION_MS:86400000}");
        assertThat(props.getProperty("corsAllowedOrigins")).isEqualTo("http://localhost:5173");
        assertThat(props.getProperty("server.port")).isEqualTo("8080");
    }

    private StandardEnvironment environmentWith(Map<String, Object> overrides) {
        StandardEnvironment env = new StandardEnvironment();
        env.getPropertySources().remove(StandardEnvironment.SYSTEM_ENVIRONMENT_PROPERTY_SOURCE_NAME);
        env.getPropertySources().remove(StandardEnvironment.SYSTEM_PROPERTIES_PROPERTY_SOURCE_NAME);
        env.getPropertySources().addFirst(new MapPropertySource("overrides", overrides));
        env.getPropertySources().addLast(new PropertiesPropertySource("application", loadApplicationYaml()));
        return env;
    }

    @Test
    void tokenLifetimeDefaultsToOneDay() {
        StandardEnvironment env = environmentWith(Map.of());

        assertThat(env.getProperty("jwt.expiration-ms", Long.class)).isEqualTo(86_400_000L);
    }

    @Test
    void tokenLifetimeCanBeOverriddenWithEnvironmentVariable() {
        StandardEnvironment env = environmentWith(Map.of("JWT_EXPIRATION_MS", "3600000"));

        assertThat(env.getProperty("jwt.expiration-ms", Long.class)).isEqualTo(3_600_000L);
    }

    @Test
    void databaseConnectionComesFromEnvironmentVariables() {
        StandardEnvironment env = environmentWith(Map.of(
                "DB_URL", "jdbc:postgresql://db.example.com:5432/example",
                "DB_USERNAME", "example_user",
                "DB_PASSWORD", "example_password"));

        assertThat(env.getProperty("spring.datasource.url"))
                .isEqualTo("jdbc:postgresql://db.example.com:5432/example");
        assertThat(env.getProperty("spring.datasource.username")).isEqualTo("example_user");
        assertThat(env.getProperty("spring.datasource.password")).isEqualTo("example_password");
    }

    @Test
    void databaseConnectionHasNoBuiltInDefaults() {
        StandardEnvironment env = environmentWith(Map.of());

        assertThatThrownBy(() -> env.getProperty("spring.datasource.url"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("DB_URL");
        assertThatThrownBy(() -> env.getProperty("spring.datasource.username"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("DB_USERNAME");
    }

    @Test
    void keepsDatabaseAndJpaSettings() {
        Properties props = loadApplicationYaml();

        assertThat(props.getProperty("spring.datasource.url")).isEqualTo("${DB_URL}");
        assertThat(props.getProperty("spring.datasource.username")).isEqualTo("${DB_USERNAME}");
        assertThat(props.getProperty("spring.datasource.password")).isEqualTo("${DB_PASSWORD}");
        assertThat(props.getProperty("spring.datasource.driver-class-name")).isEqualTo("org.postgresql.Driver");
        assertThat(props.getProperty("spring.jpa.hibernate.ddl-auto")).isEqualTo("validate");
        assertThat(props.getProperty("spring.jpa.open-in-view")).isEqualTo("false");
        assertThat(props.getProperty("spring.jpa.properties.hibernate.type.json_format_mapper"))
                .isEqualTo("org.hibernate.type.format.jackson.Jackson3JsonFormatMapper");
        assertThat(props.getProperty("spring.jpa.properties.hibernate.jdbc.lob.non_contextual_creation"))
                .isEqualTo("true");
        assertThat(props.getProperty("spring.jpa.properties.hibernate.boot.allow_jdbc_metadata_access"))
                .isEqualTo("true");
        assertThat(props.getProperty("spring.jackson.property-naming-strategy")).isEqualTo("SNAKE_CASE");
    }
}
