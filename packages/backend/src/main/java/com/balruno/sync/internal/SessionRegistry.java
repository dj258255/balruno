// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.sync.internal;

import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketSession;

import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * In-memory {@code projectId → Set<WebSocketSession>} index.
 *
 * Why in-memory: ADR 0007 §3.1 — we run a single prod_app instance for
 * Stage 0/1, so memory routing is the simplest right answer. The
 * day a load-balancer fronts multiple sync instances, this becomes a
 * Redis pub/sub or a Modulith event bus — the rest of the module is
 * already structured around the {@code register} / {@code broadcast}
 * surface so the swap is local to this class.
 *
 * Concurrency: ConcurrentHashMap + Collections.newSetFromMap is enough
 * — the hot paths are O(active sessions per project) and our cap at
 * Stage 0 is single-digit collaborators per project (ADR 0016 FREE
 * limits). When multi-tab presence broadcasts grow, swap to a
 * CopyOnWriteArraySet per project (read-mostly).
 */
@Component
class SessionRegistry {

    private final Map<UUID, Set<WebSocketSession>> byProject = new ConcurrentHashMap<>();

    void register(UUID projectId, WebSocketSession session) {
        byProject.computeIfAbsent(projectId, k -> ConcurrentHashMap.newKeySet()).add(session);
    }

    void unregister(UUID projectId, WebSocketSession session) {
        var sessions = byProject.get(projectId);
        if (sessions == null) return;
        sessions.remove(session);
        if (sessions.isEmpty()) byProject.remove(projectId);
    }

    Set<WebSocketSession> sessionsFor(UUID projectId) {
        var s = byProject.get(projectId);
        return s == null ? Set.of() : s;
    }
}
