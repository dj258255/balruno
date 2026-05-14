// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.sync.internal;

import com.balruno.events.InboundRowRequestedEvent;
import com.balruno.sync.SyncMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

import java.util.UUID;

/**
 * Bridges {@link InboundRowRequestedEvent} (fired by the inbound
 * webhook module) into a real {@code row.add} op via
 * {@link SheetCellOpService}.
 *
 * Lives inside the sync module so the inbound module never has a
 * static dep on sync — the same modulith decoupling pattern as the
 * webhook outbound listener.
 */
@Component
class InboundRowEventListener {

    private static final Logger log = LoggerFactory.getLogger(InboundRowEventListener.class);

    private final SheetCellOpService sheetOps;

    InboundRowEventListener(SheetCellOpService sheetOps) {
        this.sheetOps = sheetOps;
    }

    @EventListener
    public void onInboundRow(InboundRowRequestedEvent event) {
        try {
            // baseVersion = 0 placeholder triggers a conflict path; we
            // need the *current* version. SheetCellOpService.apply
            // detects the conflict and returns Conflict — but for an
            // inbound webhook we want a successful append regardless
            // of concurrent edits. Read version inline + retry once.
            // Simpler: use a dedicated unconditional-append entry.
            sheetOps.applyAppendRow(event.projectId(), event.actorUserId(),
                    event.sheetId(), event.rowId(), event.rowJson());
        } catch (Exception e) {
            // Pass `e` as the final SLF4J argument so the stack trace
            // lands in the log — the previous `e.getMessage()` form
            // dropped the trace and turned this into a silent failure.
            log.warn("inbound row append failed projectId={} sheetId={}",
                    event.projectId(), event.sheetId(), e);
        }
    }
}
