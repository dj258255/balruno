// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.history.internal;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
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
 * Runs at 03:00 UTC — same window
 * {@link com.balruno.notification.internal.DigestScheduler} uses, so
 * Postgres locks / vacuum windows align.
 *
 * Splits into two statements rather than one TRUNCATE-style sweep so
 * the two indexes ({@code cell_history_created_idx} /
 * {@code doc_snapshots_created_idx}) are hit by a precise predicate
 * — Postgres can use them as range scans.
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

    private final JdbcTemplate jdbc;

    HistoryCleanupScheduler(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Scheduled(cron = "0 0 3 * * *", zone = "UTC")
    @Transactional
    public void prune() {
        try {
            var cellRows = jdbc.update(
                    "DELETE FROM cell_history WHERE created_at < now() - make_interval(days => ?)",
                    MAX_RETENTION_DAYS);
            var snapshotRows = jdbc.update(
                    "DELETE FROM doc_snapshots WHERE created_at < now() - make_interval(days => ?)",
                    MAX_RETENTION_DAYS);
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
