// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.storage.internal;

import com.balruno.storage.WorkspaceStorageService;
import com.balruno.workspace.LimitGuard;
import com.balruno.workspace.WorkspaceLimits;
import com.balruno.workspace.WorkspaceService;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/**
 * Backed by the {@code workspace_storage} table (V28). Each mutating
 * call uses {@code SELECT ... FOR UPDATE} so the read-modify-write
 * cycle holds a row lock for the duration of the surrounding
 * transaction — concurrent uploads serialise rather than racing.
 *
 * Plan lookup goes through a tiny callback so the workspace module
 * doesn't have to expose a fetcher just for storage; the upload
 * controller already knows the plan via the project's workspace.
 */
@Service
class WorkspaceStorageServiceImpl implements WorkspaceStorageService {

    private final JdbcTemplate jdbc;
    private final LimitGuard limitGuard;
    private final WorkspaceService workspaces;

    WorkspaceStorageServiceImpl(JdbcTemplate jdbc,
                                LimitGuard limitGuard,
                                WorkspaceService workspaces) {
        this.jdbc = jdbc;
        this.limitGuard = limitGuard;
        this.workspaces = workspaces;
    }

    @Override
    @Transactional
    public void incrementOrThrow(UUID workspaceId, long delta) {
        if (delta <= 0) return;
        // FOR UPDATE serialises concurrent uploads against the same
        // workspace; without it two parallel uploads can both pass
        // the pre-check and collectively breach the cap.
        var current = jdbc.queryForObject(
                "SELECT total_bytes FROM workspace_storage "
              + " WHERE workspace_id = ? FOR UPDATE",
                Long.class, workspaceId);
        var prevBytes = current == null ? 0L : current;

        var plan = workspaces.findById(workspaceId).plan();
        var limits = WorkspaceLimits.forPlan(plan);
        var nextBytes = prevBytes + delta;
        // Pre-mutation check — LimitGuard.requireBelow expects
        // current to be the pre-mutation count and limit to be the
        // total cap. We pass nextBytes - 1 so the guard fires when
        // nextBytes >= limit (i.e. the new upload would breach it).
        limitGuard.requireBelow(plan, "attachmentBytes",
                nextBytes - 1, limits.maxAttachmentBytes());

        jdbc.update(
                "UPDATE workspace_storage "
              + "    SET total_bytes = total_bytes + ?, updated_at = now() "
              + "  WHERE workspace_id = ?",
                delta, workspaceId);
    }

    @Override
    @Transactional
    public void decrement(UUID workspaceId, long delta) {
        if (delta <= 0) return;
        // GREATEST(0, ...) clamps to zero so accounting drift never
        // produces a negative counter — a soft invariant the CHECK
        // constraint also enforces at the DB level.
        jdbc.update(
                "UPDATE workspace_storage "
              + "    SET total_bytes = GREATEST(0, total_bytes - ?), updated_at = now() "
              + "  WHERE workspace_id = ?",
                delta, workspaceId);
    }

    @Override
    @Transactional(readOnly = true)
    public long currentBytes(UUID workspaceId) {
        try {
            var bytes = jdbc.queryForObject(
                    "SELECT total_bytes FROM workspace_storage WHERE workspace_id = ?",
                    Long.class, workspaceId);
            return bytes == null ? 0L : bytes;
        } catch (EmptyResultDataAccessException e) {
            // Workspace existed before V28 backfill ran (test fixtures
            // bypass migrations occasionally) — fall back to zero
            // rather than 500-erroring the upload.
            return 0L;
        }
    }

}
