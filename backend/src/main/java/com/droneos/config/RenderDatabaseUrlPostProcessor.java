package com.droneos.config;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.env.EnvironmentPostProcessor;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.MapPropertySource;

import java.net.URI;
import java.util.Arrays;
import java.util.HashMap;
import java.util.Map;

/**
 * Converts Render.com's postgres:// / postgresql:// DATABASE URL format
 * into a valid Spring Boot JDBC URL before any beans are created.
 *
 * Render provides DATABASE_URL / SPRING_DATASOURCE_URL in the format:
 *   postgres://user:password@host:port/database
 *
 * Spring Boot / HikariCP requires:
 *   jdbc:postgresql://host:port/database  (credentials via separate properties)
 *
 * This processor also:
 *  - Forces spring.datasource.driver-class-name to org.postgresql.Driver
 *  - Activates the "prod" Spring profile if not already active
 *
 * This makes the app self-healing: even if SPRING_PROFILES_ACTIVE=prod is
 * not set in Render's environment variables, the correct config loads.
 */
public class RenderDatabaseUrlPostProcessor implements EnvironmentPostProcessor {

    @Override
    public void postProcessEnvironment(ConfigurableEnvironment environment,
                                       SpringApplication application) {
        // Check both common Render env var names
        String rawUrl = environment.getProperty("SPRING_DATASOURCE_URL");
        if (rawUrl == null) {
            rawUrl = environment.getProperty("DATABASE_URL");
        }

        if (rawUrl == null || rawUrl.startsWith("jdbc:")) {
            // Already correct format or not set — nothing to do
            return;
        }

        // Convert postgres:// or postgresql:// -> jdbc:postgresql://host:port/db
        String jdbcUrl = toJdbcUrl(rawUrl);
        if (jdbcUrl == null) return;

        Map<String, Object> props = new HashMap<>();
        props.put("spring.datasource.url", jdbcUrl);

        // Force the correct driver — prevents H2 from being picked when it is
        // on the classpath (e.g. during local 'mvn spring-boot:run' with the
        // DATABASE_URL env var accidentally set).
        props.put("spring.datasource.driver-class-name", "org.postgresql.Driver");

        // Extract credentials from the URL if not already set separately
        try {
            URI uri = new URI(rawUrl);
            String userInfo = uri.getUserInfo();
            if (userInfo != null && !userInfo.isEmpty()) {
                String[] parts = userInfo.split(":", 2);
                if (parts.length == 2) {
                    // Only set if not already defined as separate env vars
                    if (environment.getProperty("DB_USERNAME") == null
                            && environment.getProperty("spring.datasource.username") == null) {
                        props.put("spring.datasource.username", parts[0]);
                    }
                    if (environment.getProperty("DB_PASSWORD") == null
                            && environment.getProperty("spring.datasource.password") == null) {
                        props.put("spring.datasource.password", parts[1]);
                    }
                }
            }
        } catch (Exception ignored) {
            // If URI parsing fails, credentials stay from env vars
        }

        environment.getPropertySources()
                .addFirst(new MapPropertySource("renderDatabaseUrl", props));

        // Activate the "prod" profile if it isn't already active.
        // This ensures application-prod.yml (PostgreSQL dialect, ddl-auto=update,
        // etc.) is loaded even when SPRING_PROFILES_ACTIVE is not set on Render.
        boolean prodAlreadyActive = Arrays.asList(environment.getActiveProfiles()).contains("prod");
        if (!prodAlreadyActive) {
            environment.addActiveProfile("prod");
            System.out.println("[RenderDatabaseUrlPostProcessor] Activated 'prod' profile automatically.");
        }

        System.out.printf("[RenderDatabaseUrlPostProcessor] Converted datasource URL%n"
                + "  From: %s%n"
                + "  To:   %s%n"
                + "  Driver: org.postgresql.Driver%n",
                maskCredentials(rawUrl), jdbcUrl);
    }

    /**
     * Converts postgres[ql]://[user:pass@]host[:port]/db
     * to jdbc:postgresql://host:port/db
     */
    private String toJdbcUrl(String raw) {
        try {
            // Normalise scheme so java.net.URI can parse it
            String normalized = raw
                    .replaceFirst("^postgresql://", "postgres://");

            URI uri = new URI(normalized);
            String host = uri.getHost();
            int    port = uri.getPort() == -1 ? 5432 : uri.getPort();
            String path = uri.getPath(); // e.g. "/dronedb"

            if (host == null || path == null || path.isEmpty()) return null;

            return String.format("jdbc:postgresql://%s:%d%s", host, port, path);
        } catch (Exception e) {
            System.err.println("[RenderDatabaseUrlPostProcessor] Failed to parse URL: " + e.getMessage());
            return null;
        }
    }

    private String maskCredentials(String url) {
        return url.replaceAll("://[^@]+@", "://<credentials>@");
    }
}
