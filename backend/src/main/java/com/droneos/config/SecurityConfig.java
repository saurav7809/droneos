package com.droneos.config;

import com.droneos.security.JwtAuthFilter;
import com.droneos.security.UserDetailsServiceImpl;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    // UserDetailsServiceImpl is a @Service, NOT defined inside SecurityConfig,
    // so there is no circular dependency with JwtAuthFilter.
    private final UserDetailsServiceImpl userDetailsService;
    private final JwtAuthFilter jwtAuthFilter;

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        return http
                .csrf(AbstractHttpConfigurer::disable)
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .authorizeHttpRequests(auth -> auth
                        // Auth endpoints, WebSocket, H2 console (dev only)
                        .requestMatchers("/", "/api/auth/**", "/ws/**", "/h2-console/**").permitAll()
                        // Render health-check hits /actuator/health unauthenticated
                        .requestMatchers("/actuator/health", "/actuator/info").permitAll()
                        .anyRequest().authenticated()
                )
                .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authenticationProvider(authenticationProvider())
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class)
                .headers(h -> h.frameOptions(f -> f.disable()))
                .build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();

        // CORS_ALLOWED_ORIGINS accepts comma-separated exact origins OR wildcard patterns.
        // Wildcards (e.g. https://*.onrender.com) MUST use setAllowedOriginPatterns —
        // setAllowedOrigins rejects them. We always use patterns for consistency.
        //
        // Set via env var on Render:
        //   CORS_ALLOWED_ORIGINS=https://droneos-frontend.onrender.com,https://yourdomain.com
        String originsEnv = System.getenv("CORS_ALLOWED_ORIGINS");
        List<String> patterns;
        if (originsEnv != null && !originsEnv.isBlank()) {
            // Trim whitespace around each entry
            patterns = List.of(originsEnv.split("\\s*,\\s*"));
        } else {
            // Dev defaults — covers Vite dev server and common preview platforms
            patterns = List.of(
                "http://localhost:3000",
                "http://localhost:5173",
                "https://*.onrender.com",
                "https://*.vercel.app",
                "https://*.netlify.app"
            );
        }
        // allowedOriginPatterns supports wildcards AND exact origins
        config.setAllowedOriginPatterns(patterns);
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"));
        config.setAllowedHeaders(List.of("*"));
        config.setAllowCredentials(true);
        config.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }

    @Bean
    public AuthenticationProvider authenticationProvider() {
        DaoAuthenticationProvider provider = new DaoAuthenticationProvider();
        provider.setUserDetailsService(userDetailsService);
        provider.setPasswordEncoder(passwordEncoder());
        return provider;
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
