// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.sync.internal;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.util.UUID;

/**
 * Handler for {@code /ws/projects/{id}}. Stage B.1 scope is the
 * connection lifecycle skeleton only — auth (Stage B.3 / C), op log
 * services (B.4-B.5), and the {@code sync.full} hydrate (B.5) land in
 * subsequent commits.
 *
 * Path-variable extraction: the URL template registered in
 * {@link ProjectWebSocketConfig} populates {@code session.uri} with the
 * concrete projectId. We pull it once at connect time and stash it as a
 * session attribute so every later message hop is a Map lookup, not a
 * URL re-parse.
 */
@Component
class ProjectWebSocketHandler extends TextWebSocketHandler {

    private static final Logger log = LoggerFactory.getLogger(ProjectWebSocketHandler.class);
    static final String ATTR_PROJECT_ID = "balruno.projectId";

    private final SessionRegistry sessions;

    ProjectWebSocketHandler(SessionRegistry sessions) {
        this.sessions = sessions;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        var projectId = extractProjectId(session);
        if (projectId == null) {
            session.close(CloseStatus.BAD_DATA.withReason("missing or malformed projectId"));
            return;
        }
        session.getAttributes().put(ATTR_PROJECT_ID, projectId);
        sessions.register(projectId, session);
        log.info("ws_connect projectId={} sessionId={}", projectId, session.getId());
        // Stage B.5: send sync.full hydrate here once the loader exists.
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        // Stage B.4-B.5: parse SyncMessage, dispatch to SheetCellOpService /
        // TreeOpService / presence broadcaster, write op_idempotency, broadcast
        // to siblings. For now we just no-op so connect/close cycles stay
        // quiet during early integration smoke tests.
        log.debug("ws_message_dropped sessionId={} payloadBytes={}",
                session.getId(), message.getPayloadLength());
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
        var projectId = (UUID) session.getAttributes().get(ATTR_PROJECT_ID);
        if (projectId != null) {
            sessions.unregister(projectId, session);
        }
        log.info("ws_close projectId={} sessionId={} status={}",
                projectId, session.getId(), status.getCode());
    }

    private static UUID extractProjectId(WebSocketSession session) {
        var uri = session.getUri();
        if (uri == null) return null;
        var path = uri.getPath();
        // /ws/projects/{id} — id is the trailing segment.
        var slash = path.lastIndexOf('/');
        if (slash < 0 || slash == path.length() - 1) return null;
        try {
            return UUID.fromString(path.substring(slash + 1));
        } catch (IllegalArgumentException ignored) {
            return null;
        }
    }
}
