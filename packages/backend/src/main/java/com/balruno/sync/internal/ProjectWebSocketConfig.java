// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.sync.internal;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

/**
 * Native WebSocket wiring for {@code /ws/projects/{id}} — sheet cell +
 * sheet tree + doc tree op log channel (ADR 0008 v2.0 §2).
 *
 * Stage B.1 scope: handler is registered at the path; auth interceptor
 * lands in Stage B.3 (cookie / query param JWT verification mirroring
 * the resource-server config). Until then a connect succeeds without
 * authentication checks at this layer, so the path stays internal —
 * nginx is not yet pointed at this upstream.
 *
 * AllowedOrigins matches the API CORS list (ADR 0017 §2). The frontend
 * connects from balruno.com (Vercel) or localhost for dev.
 */
@Configuration
@EnableWebSocket
class ProjectWebSocketConfig implements WebSocketConfigurer {

    private final ProjectWebSocketHandler handler;

    ProjectWebSocketConfig(ProjectWebSocketHandler handler) {
        this.handler = handler;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry
                .addHandler(handler, "/ws/projects/{id}")
                .setAllowedOriginPatterns(
                        "https://*.balruno.com",
                        "https://balruno.com",
                        "http://localhost:*",
                        "http://127.0.0.1:*");
    }
}
