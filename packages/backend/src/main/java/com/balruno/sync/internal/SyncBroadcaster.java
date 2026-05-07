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

    void dispatch(UUID projectId, WebSocketSession sender, UUID clientMsgId, SyncResult result) {
        switch (result) {
            case SyncResult.Acked acked -> {
                sendQuietly(sender, ackedReply(clientMsgId, acked.version()));
                broadcastQuietly(projectId, acked.broadcastPayload());
            }
            case SyncResult.Conflict conflict ->
                    sendQuietly(sender, conflictReply(conflict.serverVersion()));
            case SyncResult.Cached cached -> {
                // Re-send the originally cached envelope so the client
                // sees the same op.acked it would have seen the first
                // time. No re-broadcast — the rest of the project saw
                // the change when the original op landed.
                sendQuietly(sender, cached.payload());
            }
        }
    }

    private String ackedReply(UUID clientMsgId, long version) {
        var envelope = new LinkedHashMap<String, Object>();
        envelope.put("type", "op.acked");
        envelope.put("clientMsgId", clientMsgId.toString());
        envelope.put("version", version);
        return writeOrFallback(envelope);
    }

    private String conflictReply(long serverVersion) {
        var envelope = new LinkedHashMap<String, Object>();
        envelope.put("type", "conflict");
        envelope.put("serverVersion", serverVersion);
        return writeOrFallback(envelope);
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
