// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.sync.internal;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;

import java.util.Map;
import java.util.UUID;

/**
 * Verifies the session JWT during the WebSocket upgrade handshake.
 *
 * Two transport channels for the token, in priority order:
 *   1. {@code balruno_session} cookie (browsers — same path the REST API
 *      uses, so a logged-in tab opens the WS without an extra round trip).
 *   2. {@code ?token=<bearer>} query param (non-browser clients without
 *      cookie support — Electron, future CLI; the bearer is the same
 *      JWT, just transported differently).
 *
 * On success the verified subject is stashed under
 * {@link ProjectWebSocketHandler#ATTR_USER_ID}; the handler reads it
 * directly. On failure the handshake is rejected (returns false →
 * 401), which is the right shape — Spring's WS upgrade machinery
 * surfaces it as a clean refusal, not a 500.
 *
 * The JwtDecoder bean comes from {@code SecurityConfig} (user module's
 * public-by-Spring-Security bean). Reusing it keeps the HS256 secret
 * in one place; rotating it rotates both REST and WS sessions.
 */
@Component
class SyncHandshakeInterceptor implements HandshakeInterceptor {

    private static final Logger log = LoggerFactory.getLogger(SyncHandshakeInterceptor.class);

    private final JwtDecoder jwtDecoder;
    private final String cookieName;

    SyncHandshakeInterceptor(JwtDecoder jwtDecoder,
                             @Value("${balruno.jwt.cookie-name:balruno_session}") String cookieName) {
        this.jwtDecoder = jwtDecoder;
        this.cookieName = cookieName;
    }

    @Override
    public boolean beforeHandshake(ServerHttpRequest request,
                                   ServerHttpResponse response,
                                   WebSocketHandler wsHandler,
                                   Map<String, Object> attributes) {
        var token = extractToken(request);
        if (token == null || token.isBlank()) {
            log.info("ws_handshake_no_token uri={}", request.getURI());
            return false;
        }
        try {
            var jwt = jwtDecoder.decode(token);
            var userId = UUID.fromString(jwt.getSubject());
            attributes.put(ProjectWebSocketHandler.ATTR_USER_ID, userId);
            return true;
        } catch (JwtException | IllegalArgumentException e) {
            log.info("ws_handshake_token_invalid cause={}", e.getClass().getSimpleName());
            return false;
        }
    }

    @Override
    public void afterHandshake(ServerHttpRequest request,
                               ServerHttpResponse response,
                               WebSocketHandler wsHandler,
                               Exception exception) {
        // Nothing — Spring writes 401 on rejection automatically.
    }

    private String extractToken(ServerHttpRequest request) {
        if (request instanceof ServletServerHttpRequest servlet) {
            var cookies = servlet.getServletRequest().getCookies();
            if (cookies != null) {
                for (var c : cookies) {
                    if (cookieName.equals(c.getName())) return c.getValue();
                }
            }
        }
        var query = request.getURI().getRawQuery();
        if (query != null) {
            for (var part : query.split("&")) {
                if (part.startsWith("token=")) {
                    return java.net.URLDecoder.decode(
                            part.substring("token=".length()),
                            java.nio.charset.StandardCharsets.UTF_8);
                }
            }
        }
        return null;
    }
}
