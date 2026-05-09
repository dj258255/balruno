// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.history.internal;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Daily prune of {@code cell_history} + {@code doc_snapshots} rows
 * past the longest workspace plan's retention window (TEAM = 180d).
 *
 * Per-plan accuracy at query time is already enforced by
 * {@link HistoryServiceImpl#authorisedCutoff} and
 * {@link DocSnapshotServiceImpl}; this scheduler is a disk-protection
 * net so a noisy workspace doesn't bloat the table indefinitely.
 *
 * Runs at 03:00 UTC. Both DELETEs run as native @Modifying queries
 * on the matching repositories — they hit the
 * {@code *_created_idx} range scans and stay off JdbcTemplate.
 */
@Component
class HistoryCleanupScheduler {

    private static final Logger log = LoggerFactory.getLogger(HistoryCleanupScheduler.class);

    /**
     * Hard floor — matches the longest plan retention. Rows past this
     * are unreachable through any plan's read endpoint, so deleting
     * them never affects a user's visible history.
     */
    private static final int MAX_RETENTION_DAYS = 180;

    private final HistoryRepository history;
    private final DocSnapshotRepository snapshots;

    HistoryCleanupScheduler(HistoryRepository history, DocSnapshotRepository snapshots) {
        this.history = history;
        this.snapshots = snapshots;
    }

    @Scheduled(cron = "0 0 3 * * *", zone = "UTC")
    @Transactional
    public void prune() {
        try {
            var cellRows = history.pruneOlderThan(MAX_RETENTION_DAYS);
            var snapshotRows = snapshots.pruneOlderThan(MAX_RETENTION_DAYS);
            if (cellRows > 0 || snapshotRows > 0) {
                log.info("history cleanup pruned cell_history={} doc_snapshots={}",
                        cellRows, snapshotRows);
            }
        } catch (RuntimeException e) {
            // Swallow — the next daily run will retry. Bubbling here
            // would only kill the cron thread without a recovery path.
            log.error("history cleanup failed", e);
        }
    }
}
