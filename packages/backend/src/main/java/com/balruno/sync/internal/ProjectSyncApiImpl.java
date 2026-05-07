// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.sync.internal;

import com.balruno.sync.ProjectSyncApi;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.socket.TextMessage;
import tools.jackson.databind.ObjectMapper;

import java.util.LinkedHashMap;
import java.util.UUID;

/**
 * Implementation of {@link ProjectSyncApi}. Lives in
 * {@code sync.internal} alongside the WebSocket plumbing it depends on
 * (state loader + session registry); the public interface keeps the
 * cross-module surface narrow.
 *
 * Failure semantics mirror {@link SyncBroadcaster}: a per-session send
 * exception is logged and skipped, never propagated. The caller that
 * just mutated project state should not have its HTTP response failed
 * because one stale WebSocket couldn't be flushed.
 */
@Service
class ProjectSyncApiImpl implements ProjectSyncApi {

    private static final Logger log = LoggerFactory.getLogger(ProjectSyncApiImpl.class);

    private final ProjectStateLoader stateLoader;
    private final SessionRegistry sessions;
    private final ObjectMapper json;

    ProjectSyncApiImpl(ProjectStateLoader stateLoader,
                       SessionRegistry sessions,
                       ObjectMapper json) {
        this.stateLoader = stateLoader;
        this.sessions = sessions;
        this.json = json;
    }

    @Override
    public void broadcastEvent(UUID projectId, String type, Object payload) {
        var envelope = new LinkedHashMap<String, Object>();
        envelope.put("type", type);
        envelope.put("ts", System.currentTimeMillis());
        envelope.put("payload", payload);
        String serialized;
        try {
            serialized = json.writeValueAsString(envelope);
        } catch (Exception e) {
            log.warn("ws_event_serialize_failed projectId={} type={} cause={}",
                    projectId, type, e.getClass().getSimpleName());
            return;
        }
        var msg = new TextMessage(serialized);
        for (var session : sessions.sessionsFor(projectId)) {
            try {
                if (session.isOpen()) session.sendMessage(msg);
            } catch (Exception e) {
                log.warn("ws_event_send_failed sessionId={} type={} cause={}",
                        session.getId(), type, e.getClass().getSimpleName());
            }
        }
    }

    @Override
    public void broadcastFullStateSnapshot(UUID projectId) {
        String payload;
        try {
            payload = stateLoader.loadFull(projectId);
        } catch (RuntimeException e) {
            log.warn("ws_full_snapshot_load_failed projectId={} cause={}",
                    projectId, e.getClass().getSimpleName());
            return;
        }
        var msg = new TextMessage(payload);
        for (var session : sessions.sessionsFor(projectId)) {
            try {
                if (session.isOpen()) session.sendMessage(msg);
            } catch (Exception e) {
                log.warn("ws_full_snapshot_send_failed sessionId={} cause={}",
                        session.getId(), e.getClass().getSimpleName());
            }
        }
    }
}
