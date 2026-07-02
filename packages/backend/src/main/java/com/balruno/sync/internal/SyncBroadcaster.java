// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.sync.internal;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import tools.jackson.databind.ObjectMapper;

import java.util.LinkedHashMap;
import java.util.UUID;

/**
 * Translates a {@link SyncResult} into wire messages — sender ack /
 * conflict / cached replay + broadcast to other sessions on the same
 * project. Lives in its own component so the handler stays a thin
 * dispatcher and the message envelope shapes can be unit-tested
 * without spinning a WebSocket session.
 *
 * Sender visibility (ADR 0008 §6 Q7): broadcast goes to every session
 * in the project including the originator. The originator dedupes on
 * {@code clientMsgId} client-side so its local state isn't double-
 * applied; receiving the echo is what carries the server-assigned
 * {@code version} that future ops must use as {@code baseVersion}.
 */
@Component
class SyncBroadcaster {

    private static final Logger log = LoggerFactory.getLogger(SyncBroadcaster.class);

    private final SessionRegistry sessions;
    private final ObjectMapper json;

    SyncBroadcaster(SessionRegistry sessions, ObjectMapper json) {
        this.sessions = sessions;
        this.json = json;
    }

    /**
     * @param scope which version region this op rode — "data" or
     *              "sheetTree" (mirrors the independent version
     *              columns, ADR 0008 v2.0 §3). The sender's bridge
     *              advances ONLY this region's baseVersion on op.acked /
     *              adopts the server value on conflict. Without it the
     *              client cannot tell which counter moved and
     *              historically bumped every region, inflating the idle
     *              ones so every later op against them conflicted.
     */
    void dispatch(UUID projectId, WebSocketSession sender, UUID clientMsgId,
                  String scope, SyncResult result) {
        switch (result) {
            case SyncResult.Acked acked -> {
                sendQuietly(sender, ackedReply(clientMsgId, scope, acked.version()));
                broadcastQuietly(projectId, acked.broadcastPayload());
            }
            case SyncResult.Conflict conflict ->
                    sendQuietly(sender, conflictReply(clientMsgId, scope, conflict.serverVersion()));
            case SyncResult.Cached cached -> {
                // Re-send the originally cached envelope so the client
                // sees the same op.acked it would have seen the first
                // time. No re-broadcast — the rest of the project saw
                // the change when the original op landed. The cached
                // payload is the broadcast echo (op shape + version),
                // which the client routes by treeKind on its own, so it
                // needs no scope hint here.
                sendQuietly(sender, cached.payload());
            }
        }
    }

    private String ackedReply(UUID clientMsgId, String scope, long version) {
        var envelope = new LinkedHashMap<String, Object>();
        envelope.put("type", "op.acked");
        envelope.put("clientMsgId", clientMsgId.toString());
        envelope.put("scope", scope);
        envelope.put("version", version);
        return writeOrFallback(envelope);
    }

    private String conflictReply(UUID clientMsgId, String scope, long serverVersion) {
        var envelope = new LinkedHashMap<String, Object>();
        envelope.put("type", "conflict");
        // Identifies WHICH op was rejected so the client can retry it
        // once on the healed baseVersion. Without it a conflicted op was
        // silently dropped — optimistic state diverged until the next
        // sync.full made it "vanish".
        envelope.put("clientMsgId", clientMsgId.toString());
        envelope.put("scope", scope);
        envelope.put("serverVersion", serverVersion);
        return writeOrFallback(envelope);
    }

    /**
     * Op-level rejection for validation failures (row/parent not
     * found, malformed op) — anything that used to THROW out of the
     * handler and let Spring's ExceptionWebSocketHandlerDecorator
     * close the whole socket. Reuses the {@code conflict} type so the
     * client's existing retry-once path handles it: no {@code scope}
     * means "not a version mismatch, don't touch your counters"; the
     * retry will fail the same way and surface a toast instead of a
     * silent socket death + sync.full wipe.
     */
    void rejectOp(WebSocketSession sender, UUID clientMsgId, String reason, String detail) {
        var envelope = new LinkedHashMap<String, Object>();
        envelope.put("type", "conflict");
        envelope.put("clientMsgId", clientMsgId.toString());
        envelope.put("reason", reason);
        if (detail != null) envelope.put("detail", detail);
        sendQuietly(sender, writeOrFallback(envelope));
    }

    /**
     * Plan-limit rejection — same envelope but with the structured
     * quota fields the frontend's quota toast renders (mirrors the
     * RFC 7807 extensions ApiExceptionHandler emits on the REST path,
     * FR-LIMIT-002), including the upgrade nudge.
     */
    void rejectQuota(WebSocketSession sender, UUID clientMsgId,
                     com.balruno.workspace.QuotaException qe) {
        var envelope = new LinkedHashMap<String, Object>();
        envelope.put("type", "conflict");
        envelope.put("clientMsgId", clientMsgId.toString());
        envelope.put("reason", "quota_exceeded");
        envelope.put("quotaKey", qe.quotaKey());
        envelope.put("current", qe.current());
        envelope.put("limit", qe.limit());
        envelope.put("plan", qe.plan().name());
        sendQuietly(sender, writeOrFallback(envelope));
    }

    private String writeOrFallback(LinkedHashMap<String, Object> envelope) {
        try {
            return json.writeValueAsString(envelope);
        } catch (Exception e) {
            log.error("ws_envelope_serialize_failed cause={}", e.getClass().getSimpleName(), e);
            // Fall back to a static string the client recognises as a
            // server-side error rather than dropping the reply silently.
            return "{\"type\":\"server.error\"}";
        }
    }

    private void sendQuietly(WebSocketSession session, String payload) {
        try {
            if (session.isOpen()) session.sendMessage(new TextMessage(payload));
        } catch (Exception e) {
            log.warn("ws_send_failed sessionId={} cause={}",
                    session.getId(), e.getClass().getSimpleName());
        }
    }

    /**
     * Broadcast a payload to every session of a project — no sender to
     * exclude. Used by REST-origin paths like UndoService where the
     * trigger came in over HTTP, not wss. The originating user's *own*
     * tabs receive the broadcast too (Cmd+Z fires from one tab; their
     * other open tabs of the same project should see the resulting
     * state change).
     */
    void broadcastFromRest(UUID projectId, String payload) {
        broadcastQuietly(projectId, payload);
    }

    private void broadcastQuietly(UUID projectId, String payload) {
        var msg = new TextMessage(payload);
        var recipients = sessions.sessionsFor(projectId);
        for (var session : recipients) {
            try {
                if (session.isOpen()) session.sendMessage(msg);
            } catch (Exception e) {
                log.warn("ws_broadcast_failed sessionId={} cause={}",
                        session.getId(), e.getClass().getSimpleName());
            }
        }
    }

    /**
     * Presence broadcast — fire-and-forget. Goes to peers only (the
     * sender is excluded; their cursor is already on their own
     * screen). No idempotency, no version, no sender ack — losing a
     * frame is fine because the next mouse move replaces the state
     * within milliseconds.
     */
    void broadcastPresence(UUID projectId, WebSocketSession sender, UUID userId, Object cursor) {
        var envelope = new LinkedHashMap<String, Object>();
        envelope.put("type", "presence");
        envelope.put("userId", userId.toString());
        envelope.put("ts", System.currentTimeMillis());
        envelope.put("cursor", cursor);
        var payload = writeOrFallback(envelope);
        var msg = new TextMessage(payload);
        var recipients = sessions.sessionsFor(projectId);
        for (var session : recipients) {
            if (session == sender) continue; // skip echo to sender
            try {
                if (session.isOpen()) session.sendMessage(msg);
            } catch (Exception e) {
                log.warn("ws_presence_failed sessionId={} cause={}",
                        session.getId(), e.getClass().getSimpleName());
            }
        }
    }
}
