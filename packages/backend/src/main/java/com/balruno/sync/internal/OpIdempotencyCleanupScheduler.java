// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.sync.internal;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Daily prune of {@code op_idempotency} rows past the undo retention
 * window. ADR 0008 v2.0 V8 schema comment marks this as
 * "7-day retention cron, 별도 phase" — this scheduler closes that
 * phase.
 *
 * Why this matters: every committed sheet/tree/doc op writes one row.
 * Active projects rack up hundreds per day per user; without prune the
 * table grows unbounded for the lifetime of the deployment. The V14
 * partial indexes (op_idempotency_undo_lookup, op_idempotency_redo_lookup)
 * stay fast because their filter excludes expired rows, but the heap
 * itself keeps growing without cleanup.
 *
 * Retention picked at 7 days:
 *   - safely past the 120-min Cmd+Z reversibleUntil window
 *     ({@link UndoServiceImpl}) so an active user's undo stack never
 *     sees a hole
 *   - lets a v8 idempotency replay survive a long-tab session before
 *     the row evaporates
 *   - keeps the table small enough that the daily DELETE stays
 *     under a second on the prod_app ARM 12GB host
 *
 * Mirrors {@link com.balruno.history.internal.HistoryCleanupScheduler}'s
 * shape: native @Modifying via the repository, scheduled at 03:00 UTC
 * so it doesn't collide with the history cleanup that runs in the
 * same slot but on different tables.
 */
@Component
class OpIdempotencyCleanupScheduler {

    private static final Logger log = LoggerFactory.getLogger(OpIdempotencyCleanupScheduler.class);

    /** 7-day retention — see class Javadoc. */
    private static final int RETENTION_DAYS = 7;

    private final OpIdempotencyRepository idempotency;

    OpIdempotencyCleanupScheduler(OpIdempotencyRepository idempotency) {
        this.idempotency = idempotency;
    }

    @Scheduled(cron = "0 15 3 * * *", zone = "UTC")
    @Transactional
    public void prune() {
        try {
            var rows = idempotency.pruneOlderThan(RETENTION_DAYS);
            if (rows > 0) {
                log.info("op_idempotency cleanup pruned rows={} retentionDays={}",
                        rows, RETENTION_DAYS);
            }
        } catch (RuntimeException e) {
            // Swallow — the next daily run will retry. Bubbling here
            // would only kill the cron thread without a recovery path.
            log.error("op_idempotency cleanup failed", e);
        }
    }
}
