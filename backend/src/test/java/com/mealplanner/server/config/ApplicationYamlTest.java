package com.mealplanner.server.config;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.config.YamlPropertiesFactoryBean;
import org.springframework.core.io.ClassPathResource;

import java.util.Properties;

import static org.assertj.core.api.Assertions.assertThat;

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
        assertThat(props.getProperty("jwt.expiration-ms")).isEqualTo("86400000");
        assertThat(props.getProperty("corsAllowedOrigins")).isEqualTo("http://localhost:5173");
        assertThat(props.getProperty("server.port")).isEqualTo("8080");
    }

    @Test
    void keepsDatabaseAndJpaSettings() {
        Properties props = loadApplicationYaml();

        assertThat(props.getProperty("spring.datasource.url")).isEqualTo("${DB_URL}");
        assertThat(props.getProperty("spring.datasource.username")).isEqualTo("${DB_USERNAME}");
        assertThat(props.getProperty("spring.datasource.password")).isEqualTo("${DB_PASSWORD}");
        assertThat(props.getProperty("spring.datasource.driver-class-name")).isEqualTo("org.postgresql.Driver");
        assertThat(props.getProperty("spring.jpa.hibernate.ddl-auto")).isEqualTo("update");
        assertThat(props.getProperty("spring.jpa.open-in-view")).isEqualTo("false");
        assertThat(props.getProperty("spring.jpa.properties.hibernate.dialect"))
                .isEqualTo("org.hibernate.dialect.PostgreSQLDialect");
        assertThat(props.getProperty("spring.jpa.properties.hibernate.jdbc.lob.non_contextual_creation"))
                .isEqualTo("true");
        assertThat(props.getProperty("spring.jpa.properties.hibernate.boot.allow_jdbc_metadata_access"))
                .isEqualTo("true");
        assertThat(props.getProperty("spring.jackson.property-naming-strategy")).isEqualTo("SNAKE_CASE");
    }
}
