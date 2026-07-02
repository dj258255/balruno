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
    static final String ATTR_USER_ID    = "balruno.userId";

    private final SessionRegistry sessions;
    private final ObjectMapper json;
    private final SheetCellOpService sheetCellOps;
    private final TreeOpService treeOps;
    private final SyncBroadcaster broadcaster;
    private final ProjectStateLoader stateLoader;

    ProjectWebSocketHandler(SessionRegistry sessions,
                            ObjectMapper json,
                            SheetCellOpService sheetCellOps,
                            TreeOpService treeOps,
                            SyncBroadcaster broadcaster,
                            ProjectStateLoader stateLoader) {
        this.sessions = sessions;
        this.json = json;
        this.sheetCellOps = sheetCellOps;
        this.treeOps = treeOps;
        this.broadcaster = broadcaster;
        this.stateLoader = stateLoader;
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

        // sync.full hydrate (B.6). One SELECT pulls all three op-log
        // regions + versions in the same MVCC snapshot, so the version
        // triple the client receives is internally consistent. A
        // missing project closes the socket with NOT_ACCEPTABLE rather
        // than silently dropping the connection.
        try {
            var fullPayload = stateLoader.loadFull(projectId);
            session.sendMessage(new org.springframework.web.socket.TextMessage(fullPayload));
        } catch (IllegalStateException e) {
            log.warn("ws_hydrate_failed projectId={} cause={}",
                    projectId, e.getClass().getSimpleName());
            session.close(CloseStatus.NOT_ACCEPTABLE.withReason("project not available"));
        }
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        var projectId = (UUID) session.getAttributes().get(ATTR_PROJECT_ID);
        if (projectId == null) {
            session.close(CloseStatus.SERVER_ERROR.withReason("session missing project context"));
            return;
        }

        // userId comes from the auth handshake — SyncHandshakeInterceptor
        // pulls it out of the JWT (cookie or query-param) and parks it
        // on the session attributes. resolveUserId throws if missing so
        // the handler never runs on an unauthenticated socket.
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

        // Presence is fire-and-forget — no idempotency, no version,
        // no sender ack. Short-circuit it before the op-log switch
        // so the broadcaster's persistence + ack path never runs.
        if (op instanceof SyncMessage.Presence presence) {
            broadcaster.broadcastPresence(projectId, session, userId, presence.cursor());
            return;
        }

        // Sealed switch — every concrete record routes to exactly one
        // service, and missing a new variant becomes a compile error.
        //
        // The whole dispatch is guarded: an op that throws (row/parent
        // not found, malformed payload) must reject THAT op, not
        // propagate to Spring's ExceptionWebSocketHandlerDecorator —
        // which closes the socket, forcing a reconnect + sync.full that
        // wipes every unacked optimistic change on the client.
        try {
            dispatchOp(projectId, session, userId, op);
        } catch (com.balruno.workspace.QuotaException qe) {
            log.info("ws_op_quota_rejected sessionId={} type={} key={} current={} limit={}",
                    session.getId(), op.getClass().getSimpleName(),
                    qe.quotaKey(), qe.current(), qe.limit());
            broadcaster.rejectQuota(session, opClientMsgId(op), qe);
        } catch (Exception e) {
            log.warn("ws_op_rejected sessionId={} type={} cause={}",
                    session.getId(), op.getClass().getSimpleName(),
                    e.getClass().getSimpleName(), e);
            broadcaster.rejectOp(session, opClientMsgId(op),
                    e.getClass().getSimpleName(), e.getMessage());
        }
    }

    private void dispatchOp(UUID projectId, WebSocketSession session, UUID userId,
                            SyncMessage op) {
        var result = switch (op) {
            case SyncMessage.CellUpdate      msg -> sheetCellOps.apply(projectId, userId, msg);
            case SyncMessage.CellStyleUpdate msg -> sheetCellOps.apply(projectId, userId, msg);
            case SyncMessage.SheetMetadataUpdate msg -> sheetCellOps.apply(projectId, userId, msg);
            case SyncMessage.RowAdd          msg -> sheetCellOps.apply(projectId, userId, msg);
            case SyncMessage.RowUpdate       msg -> sheetCellOps.apply(projectId, userId, msg);
            case SyncMessage.RowDelete     msg -> sheetCellOps.apply(projectId, userId, msg);
            case SyncMessage.RowMove       msg -> sheetCellOps.apply(projectId, userId, msg);
            case SyncMessage.ColumnAdd     msg -> sheetCellOps.apply(projectId, userId, msg);
            case SyncMessage.ColumnUpdate  msg -> sheetCellOps.apply(projectId, userId, msg);
            case SyncMessage.ColumnDelete  msg -> sheetCellOps.apply(projectId, userId, msg);
            case SyncMessage.TreeAdd       msg -> treeOps.apply(projectId, userId, msg);
            case SyncMessage.TreeMove      msg -> treeOps.apply(projectId, userId, msg);
            case SyncMessage.TreeDelete    msg -> treeOps.apply(projectId, userId, msg);
            case SyncMessage.TreeRename    msg -> treeOps.apply(projectId, userId, msg);
            // Presence handled above. Listed here so the sealed
            // switch stays exhaustive and a future variant addition
            // is a compile error.
            case SyncMessage.Presence      ignored -> { yield new SyncResult.Acked(0L, "{}"); }
            // Server → client variants — clients should never send these,
            // but the compiler forces us to enumerate them.
            case SyncMessage.SyncFull      ignored -> rejectClientMessage(session, "sync.full");
            case SyncMessage.Conflict      ignored -> rejectClientMessage(session, "conflict");
            case SyncMessage.OpAcked       ignored -> rejectClientMessage(session, "op.acked");
        };

        broadcaster.dispatch(projectId, session, opClientMsgId(op), scopeOf(op), result);

        if (log.isDebugEnabled()) {
            log.debug("ws_op sessionId={} type={} result={}",
                    session.getId(), op.getClass().getSimpleName(), result);
        }
    }

    private static UUID opClientMsgId(SyncMessage op) {
        // Mirrors SheetCellOpService.clientMsgIdOf — the broadcaster
        // needs the same value to write into the op.acked envelope so
        // the originating client can match the reply to its in-flight
        // request. Presence carries no clientMsgId; we synthesise a
        // throwaway uuid so the switch stays exhaustive.
        return switch (op) {
            case SyncMessage.CellUpdate u      -> u.clientMsgId();
            case SyncMessage.CellStyleUpdate u -> u.clientMsgId();
            case SyncMessage.SheetMetadataUpdate u -> u.clientMsgId();
            case SyncMessage.RowAdd u          -> u.clientMsgId();
            case SyncMessage.RowUpdate u       -> u.clientMsgId();
            case SyncMessage.RowDelete u       -> u.clientMsgId();
            case SyncMessage.RowMove u         -> u.clientMsgId();
            case SyncMessage.ColumnAdd u       -> u.clientMsgId();
            case SyncMessage.ColumnUpdate u    -> u.clientMsgId();
            case SyncMessage.ColumnDelete u    -> u.clientMsgId();
            case SyncMessage.TreeAdd u         -> u.clientMsgId();
            case SyncMessage.TreeMove u        -> u.clientMsgId();
            case SyncMessage.TreeDelete u      -> u.clientMsgId();
            case SyncMessage.TreeRename u      -> u.clientMsgId();
            case SyncMessage.Presence ignored  -> new UUID(0L, 0L);
            case SyncMessage.SyncFull ignored  -> new UUID(0L, 0L);
            case SyncMessage.Conflict ignored  -> new UUID(0L, 0L);
            case SyncMessage.OpAcked ignored   -> new UUID(0L, 0L);
        };
    }

    /**
     * Which of the three independent version regions this op rode —
     * the server-side mirror of the frontend's writeQueue.regionOf
     * (ADR 0008 v2.0 §3). Sheet cell / row / column ops ride the
     * {@code data} column; tree ops ride {@code sheetTree}. The value
     * is echoed back in the op.acked / conflict envelope so the sender
     * advances exactly one baseVersion counter — never cross-
     * contaminates the other.
     * The server-only variants never reach a real dispatch with a
     * meaningful scope, so they fall through to {@code data}.
     */
    private static String scopeOf(SyncMessage op) {
        return switch (op) {
            case SyncMessage.TreeAdd u    -> treeScope(u.treeKind());
            case SyncMessage.TreeMove u   -> treeScope(u.treeKind());
            case SyncMessage.TreeDelete u -> treeScope(u.treeKind());
            case SyncMessage.TreeRename u -> treeScope(u.treeKind());
            default -> "data";
        };
    }

    private static String treeScope(SyncMessage.TreeKind kind) {
        // Only the sheet tree region rides this op log today.
        return "sheetTree";
    }

    private SyncResult rejectClientMessage(WebSocketSession session, String type) {
        log.warn("ws_unexpected_server_type sessionId={} type={}", session.getId(), type);
        return new SyncResult.Acked(0L, "{}");
    }

    /**
     * Reads the verified subject left by {@link SyncHandshakeInterceptor}
     * during the upgrade handshake. Connections that get this far always
     * have one — a missing attribute means the interceptor wasn't run,
     * which would be a config bug, not a runtime case to recover from.
     */
    private static UUID resolveUserId(WebSocketSession session) {
        var userId = (UUID) session.getAttributes().get(ATTR_USER_ID);
        if (userId == null) {
            throw new IllegalStateException(
                    "WebSocket session missing user id — handshake interceptor not run");
        }
        return userId;
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
