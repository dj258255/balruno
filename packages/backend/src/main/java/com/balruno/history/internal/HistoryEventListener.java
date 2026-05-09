// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.history.internal;

import com.balruno.events.SyncOpProcessedEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/**
 * SyncOpProcessedEvent → cell_history row (ADR 0038 Stage A).
 *
 * Same architecture as AuditEventListener (ADR 0032): the event is
 * defined in the leaf {@code com.balruno.events} package so the
 * publishers (sync.* services) and the consumer (history) don't form
 * a Modulith dep cycle. The publish itself runs inside the sync op's
 * own afterCommit hook, so a rolled-back op never reaches us.
 */
@Component
class HistoryEventListener {

    private static final Logger log = LoggerFactory.getLogger(HistoryEventListener.class);

    private final HistoryRepository repo;

    HistoryEventListener(HistoryRepository repo) {
        this.repo = repo;
    }

    @EventListener
    public void on(SyncOpProcessedEvent event) {
        try {
            repo.save(new HistoryEntryEntity(
                    event.projectId(),
                    event.sheetId(),
                    event.rowId(),
                    event.columnId(),
                    event.actorUserId(),
                    event.action(),
                    event.payload()));
        } catch (RuntimeException e) {
            // Swallow — best effort. cell_history is a side-channel
            // for the user's Activity tab; missing rows aren't data
            // loss for the actual sheet content.
            log.warn("history event listener failed action={} project={}",
                    event.action(), event.projectId(), e);
        }
    }
}
