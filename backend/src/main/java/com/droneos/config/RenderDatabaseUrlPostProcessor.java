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
 * IMPORTANT — Why we set JPA/Hibernate properties here instead of relying on
 * application-prod.yml:
 *
 *   EnvironmentPostProcessors run AFTER ConfigDataEnvironmentPostProcessor has
 *   already loaded all YAML files.  Calling environment.addActiveProfile("prod")
 *   here is too late to cause application-prod.yml to be re-read.  Therefore we
 *   must directly inject every property that application-prod.yml would have set.
 *
 * Properties injected when a PostgreSQL URL is detected:
 *   - spring.datasource.url              (converted JDBC URL)
 *   - spring.datasource.driver-class-name (org.postgresql.Driver)
 *   - spring.datasource.username / password (extracted from URL if embedded)
 *   - spring.jpa.database-platform       (PostgreSQLDialect)
 *   - spring.jpa.hibernate.ddl-auto      (update)
 *   - spring.jpa.show-sql                (false)
 *   - spring.sql.init.mode               (never)
 *   - spring.h2.console.enabled          (false)
 */
public class RenderDatabaseUrlPostProcessor implements EnvironmentPostProcessor {

    private static final String PG_DRIVER   = "org.postgresql.Driver";
    private static final String PG_DIALECT  = "org.hibernate.dialect.PostgreSQLDialect";

    @Override
    public void postProcessEnvironment(ConfigurableEnvironment environment,
                                       SpringApplication application) {
        // Check both common Render env var names
        String rawUrl = environment.getProperty("SPRING_DATASOURCE_URL");
        if (rawUrl == null) {
            rawUrl = environment.getProperty("DATABASE_URL");
        }

        // Nothing configured — local H2 dev mode, nothing to do
        if (rawUrl == null) {
            return;
        }

        String jdbcUrl;
        if (rawUrl.startsWith("jdbc:postgresql://") || rawUrl.startsWith("jdbc:postgres://")) {
            // Already a valid PostgreSQL JDBC URL — use as-is
            jdbcUrl = rawUrl;
        } else if (!rawUrl.startsWith("jdbc:")) {
            // Convert postgres:// or postgresql:// → jdbc:postgresql://host:port/db
            jdbcUrl = toJdbcUrl(rawUrl);
            if (jdbcUrl == null) return;
        } else {
            // Some other jdbc: URL (e.g. jdbc:h2:) — not a PostgreSQL URL, skip
            return;
        }

        Map<String, Object> props = new HashMap<>();

        // ── DataSource ─────────────────────────────────────────────────────
        props.put("spring.datasource.url",              jdbcUrl);
        props.put("spring.datasource.driver-class-name", PG_DRIVER);

        // ── Hibernate / JPA ─────────────────────────────────────────────────
        // Set these explicitly because addActiveProfile("prod") is too late to
        // re-trigger loading of application-prod.yml.
        props.put("spring.jpa.database-platform",              PG_DIALECT);
        props.put("spring.jpa.properties.hibernate.dialect",   PG_DIALECT);
        props.put("spring.jpa.hibernate.ddl-auto",             "update");
        props.put("spring.jpa.show-sql",                       "false");
        props.put("spring.jpa.open-in-view",                   "false");
        props.put("spring.jpa.defer-datasource-initialization", "true");
        props.put("spring.jpa.properties.hibernate.default_schema", "public");

        // ── Disable H2 console in production ────────────────────────────────
        props.put("spring.h2.console.enabled", "false");
        props.put("spring.sql.init.mode",      "never");

        // ── Extract credentials embedded in the URL ──────────────────────────
        try {
            URI uri = new URI(rawUrl.replaceFirst("^postgresql://", "postgres://"));
            String userInfo = uri.getUserInfo();
            if (userInfo != null && !userInfo.isEmpty()) {
                String[] parts = userInfo.split(":", 2);
                if (parts.length == 2) {
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
            // URI parse failure — credentials will come from separate env vars
        }

        // Highest-priority property source — overrides application.yml and
        // application-prod.yml for any keys we set above.
        environment.getPropertySources()
                .addFirst(new MapPropertySource("renderPostgresConfig", props));

        // Activate the prod profile (best-effort: effective for any beans that
        // query active profiles, though YAML re-loading won't be triggered).
        boolean prodAlreadyActive = Arrays.asList(environment.getActiveProfiles()).contains("prod");
        if (!prodAlreadyActive) {
            environment.addActiveProfile("prod");
        }

        System.out.printf("[RenderDatabaseUrlPostProcessor] PostgreSQL datasource configured%n"
                + "  URL:    %s%n"
                + "  Driver: %s%n"
                + "  Dialect:%s%n",
                jdbcUrl, PG_DRIVER, PG_DIALECT);
    }

    /**
     * Converts postgres[ql]://[user:pass@]host[:port]/db
     * to jdbc:postgresql://host:port/db
     */
    private String toJdbcUrl(String raw) {
        try {
            String normalized = raw.replaceFirst("^postgresql://", "postgres://");
            URI uri  = new URI(normalized);
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
