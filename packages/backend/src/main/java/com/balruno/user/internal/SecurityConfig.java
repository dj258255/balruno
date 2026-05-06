// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.user.internal;

import com.nimbusds.jose.jwk.source.ImmutableSecret;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserRequest;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserService;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.server.resource.web.BearerTokenResolver;
import org.springframework.security.oauth2.server.resource.web.DefaultBearerTokenResolver;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import javax.crypto.spec.SecretKeySpec;
import java.util.Base64;
import java.util.List;

/**
 * Spring Security wiring for the user module.
 *
 * Two parallel auth paths are stitched together here:
 *   - Inbound OAuth2 login (the "sign in with GitHub/Google" flow). Spring
 *     handles the redirect dance; on success, our handler issues a JWT
 *     and drops it into a {@code .balruno.com} cookie.
 *   - Inbound bearer JWT validation. Every {@code /api/**} call must carry
 *     our self-issued token, either in the Authorization header or in the
 *     session cookie — {@link CookieOrHeaderBearerTokenResolver} unifies
 *     the two.
 */
@Configuration
@EnableConfigurationProperties({JwtProperties.class, CorsProperties.class})
class SecurityConfig {

    @Bean
    SecurityFilterChain securityFilterChain(
            HttpSecurity http,
            OAuth2UserService<OAuth2UserRequest, OAuth2User> oauth2UserService,
            AuthenticationSuccessHandler oauth2LoginSuccessHandler,
            BearerTokenResolver bearerTokenResolver,
            AuthenticationEntryPoint jsonAuthenticationEntryPoint,
            AccessDeniedHandler jsonAccessDeniedHandler) throws Exception {
        return http
                // Stateless API — JWT in cookie does the session work, so
                // we don't want HttpSession or CSRF tokens.
                .csrf(AbstractHttpConfigurer::disable)
                // CORS bean below; Spring Security picks it up automatically.
                .cors(c -> {})
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(
                                "/", "/error",
                                "/actuator/**",
                                "/login/**", "/oauth2/**",
                                "/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html"
                        ).permitAll()
                        .requestMatchers("/api/**").authenticated()
                        .anyRequest().permitAll())
                .oauth2Login(o -> o
                        .userInfoEndpoint(u -> u.userService(oauth2UserService))
                        .successHandler(oauth2LoginSuccessHandler))
                .oauth2ResourceServer(o -> o
                        .bearerTokenResolver(bearerTokenResolver)
                        .authenticationEntryPoint(jsonAuthenticationEntryPoint)
                        .accessDeniedHandler(jsonAccessDeniedHandler)
                        .jwt(jwt -> {}))
                // Fallback for non-API paths (OAuth login redirect, etc.).
                .exceptionHandling(eh -> eh
                        .authenticationEntryPoint(jsonAuthenticationEntryPoint)
                        .accessDeniedHandler(jsonAccessDeniedHandler))
                .build();
    }

    /**
     * Cross-origin policy for the API surface. The browser session cookie
     * is httpOnly + SameSite=None (set in OAuth2LoginSuccessHandler) so
     * any origin we trust must be explicitly enumerated — wildcard is
     * incompatible with {@code allowCredentials=true}.
     *
     * The patterns themselves come from {@link CorsProperties} (bound to
     * {@code balruno.security.cors.allowed-origin-patterns}), so a
     * self-host operator can add their own domain via env without code
     * changes. The other knobs (methods/headers/credentials/max-age)
     * stay constants — they almost never change per deployment, and
     * exposing them as env would be noise.
     *
     * X-Request-Id is exposed so the frontend can echo it into bug
     * reports — RequestIdFilter guarantees one is present on every
     * response.
     */
    @Bean
    CorsConfigurationSource corsConfigurationSource(CorsProperties props) {
        var c = new CorsConfiguration();
        c.setAllowedOriginPatterns(props.allowedOriginPatterns());
        c.setAllowedMethods(List.of("GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"));
        c.setAllowedHeaders(List.of("*"));
        c.setExposedHeaders(List.of("X-Request-Id"));
        c.setAllowCredentials(true);
        c.setMaxAge(3600L);

        var src = new UrlBasedCorsConfigurationSource();
        src.registerCorsConfiguration("/api/**", c);
        // OAuth2 endpoints don't need CORS for the redirect flow itself
        // (browsers do top-level navigation, not fetch), but registering
        // them keeps any future SPA-side metadata probes working.
        src.registerCorsConfiguration("/oauth2/**", c);
        return src;
    }

    @Bean
    JwtDecoder jwtDecoder(JwtProperties props) {
        var keyBytes = Base64.getDecoder().decode(props.secret());
        var key = new SecretKeySpec(keyBytes, "HmacSHA256");
        return NimbusJwtDecoder.withSecretKey(key)
                .macAlgorithm(MacAlgorithm.HS256)
                .build();
    }

    @Bean
    BearerTokenResolver bearerTokenResolver(JwtProperties props) {
        return new CookieOrHeaderBearerTokenResolver(props.cookieName());
    }

    /**
     * Browsers send our JWT in the {@code balruno_session} cookie; API
     * clients (Electron, future CLI) send it in the Authorization header.
     * Spring's resource-server reads through {@link BearerTokenResolver},
     * so plumbing both is a one-class translation.
     */
    private static final class CookieOrHeaderBearerTokenResolver implements BearerTokenResolver {
        private final DefaultBearerTokenResolver header = new DefaultBearerTokenResolver();
        private final String cookieName;

        CookieOrHeaderBearerTokenResolver(String cookieName) {
            this.cookieName = cookieName;
        }

        @Override
        public String resolve(HttpServletRequest request) {
            var fromHeader = header.resolve(request);
            if (fromHeader != null) {
                return fromHeader;
            }
            var cookies = request.getCookies();
            if (cookies == null) {
                return null;
            }
            for (var c : cookies) {
                if (cookieName.equals(c.getName())) {
                    return c.getValue();
                }
            }
            return null;
        }
    }

    /**
     * The OAuth2 login uses our GitHub-aware service; OIDC providers
     * (Google) ride the OIDC user service that Spring autoconfigures
     * separately, so this single bean is enough.
     */
    @Bean
    OAuth2UserService<OAuth2UserRequest, OAuth2User> oauth2UserService(GitHubOAuth2UserService github) {
        return github;
    }
}
