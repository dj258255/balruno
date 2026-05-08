// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.audit.internal;

import com.balruno.events.AuditLogEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/**
 * Bridges {@link AuditLogEvent}s into a database row. Listening here
 * keeps publishers off this module's static dep graph (Spring
 * Modulith arch test pattern).
 */
@Component
class AuditEventListener {

    private static final Logger log = LoggerFactory.getLogger(AuditEventListener.class);

    private final AuditRepository repo;

    AuditEventListener(AuditRepository repo) {
        this.repo = repo;
    }

    @EventListener
    public void on(AuditLogEvent event) {
        try {
            repo.insert(event.workspaceId(), event.actorUserId(), event.action(),
                    event.resourceType(), event.resourceId(), event.payload());
        } catch (Exception e) {
            // Audit log is fire-and-forget; failure here must never
            // bubble out of an afterCommit hook.
            log.warn("audit log insert failed action={} workspaceId={}: {}",
                    event.action(), event.workspaceId(), e.getMessage());
        }
    }
}
