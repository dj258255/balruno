// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.sync.internal;

import com.balruno.sync.SyncMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;
import tools.jackson.databind.ObjectMapper;

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
    private final ObjectMapper json;
    private final SheetCellOpService sheetCellOps;
    private final TreeOpService treeOps;

    ProjectWebSocketHandler(SessionRegistry sessions,
                            ObjectMapper json,
                            SheetCellOpService sheetCellOps,
                            TreeOpService treeOps) {
        this.sessions = sessions;
        this.json = json;
        this.sheetCellOps = sheetCellOps;
        this.treeOps = treeOps;
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
        var projectId = (UUID) session.getAttributes().get(ATTR_PROJECT_ID);
        if (projectId == null) {
            session.close(CloseStatus.SERVER_ERROR.withReason("session missing project context"));
            return;
        }

        // userId comes from the auth handshake (Stage B.3). Until that lands
        // we use a deterministic placeholder so op_idempotency / audit
        // queries don't NPE during early smoke tests; real value drops in
        // when handshake JWT verification is wired.
        var userId = resolveUserId(session);

        SyncMessage op;
        try {
            op = json.readValue(message.getPayload(), SyncMessage.class);
        } catch (Exception parseError) {
            log.warn("ws_parse_failed sessionId={} cause={}",
                    session.getId(), parseError.getClass().getSimpleName());
            // Don't close — clients send presence heartbeats too; let them
            // recover from a malformed payload by sending the next one.
            return;
        }

        // Sealed switch — every concrete record routes to exactly one
        // service, and missing a new variant becomes a compile error.
        var result = switch (op) {
            case SyncMessage.CellUpdate    msg -> sheetCellOps.apply(projectId, userId, msg);
            case SyncMessage.RowAdd        msg -> sheetCellOps.apply(projectId, userId, msg);
            case SyncMessage.RowDelete     msg -> sheetCellOps.apply(projectId, userId, msg);
            case SyncMessage.RowMove       msg -> sheetCellOps.apply(projectId, userId, msg);
            case SyncMessage.ColumnAdd     msg -> sheetCellOps.apply(projectId, userId, msg);
            case SyncMessage.ColumnUpdate  msg -> sheetCellOps.apply(projectId, userId, msg);
            case SyncMessage.ColumnDelete  msg -> sheetCellOps.apply(projectId, userId, msg);
            case SyncMessage.TreeAdd       msg -> treeOps.apply(projectId, userId, msg);
            case SyncMessage.TreeMove      msg -> treeOps.apply(projectId, userId, msg);
            case SyncMessage.TreeDelete    msg -> treeOps.apply(projectId, userId, msg);
            case SyncMessage.TreeRename    msg -> treeOps.apply(projectId, userId, msg);
            case SyncMessage.Presence      msg -> SyncResult.acked(0L); // TODO B.5 broadcast
            // Server → client variants — clients should never send these,
            // but the compiler forces us to enumerate them.
            case SyncMessage.SyncFull      ignored -> rejectClientMessage(session, "sync.full");
            case SyncMessage.Conflict      ignored -> rejectClientMessage(session, "conflict");
            case SyncMessage.OpAcked       ignored -> rejectClientMessage(session, "op.acked");
        };

        // Stage B.4-B.5 follow-up: serialise result + write to sender +
        // broadcast op-shape echo to other sessions in the project. The
        // wiring lives here; the SQL inside the services is what the next
        // commits actually fill in.
        if (log.isDebugEnabled()) {
            log.debug("ws_op sessionId={} type={} result={}",
                    session.getId(), op.getClass().getSimpleName(), result);
        }
    }

    private SyncResult rejectClientMessage(WebSocketSession session, String type) {
        log.warn("ws_unexpected_server_type sessionId={} type={}", session.getId(), type);
        return SyncResult.acked(0L);
    }

    /**
     * Stage B.3 will replace this with the JWT-verified subject from the
     * handshake interceptor. The placeholder is deterministic per
     * session so the op_idempotency PK constraint can still be tested
     * end-to-end before auth lands.
     */
    private static UUID resolveUserId(WebSocketSession session) {
        var existing = (UUID) session.getAttributes().get("balruno.userId");
        if (existing != null) return existing;
        return new UUID(0L, 0L);
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
