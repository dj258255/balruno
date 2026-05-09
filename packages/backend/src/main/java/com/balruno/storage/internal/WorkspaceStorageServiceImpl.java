// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.storage.internal;

import com.balruno.storage.WorkspaceStorageService;
import com.balruno.workspace.WorkspaceLimits;
import com.balruno.workspace.WorkspaceService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/**
 * Quota-aware counter for workspace attachment bytes.
 *
 * Persistence sits in {@link WorkspaceStorageRepository}; this
 * service only handles the cap policy + workspace plan lookup.
 * The repository's {@code findForUpdate} pessimistic-locks the
 * workspace_storage row so two concurrent uploads can't both
 * pass the pre-check and collectively breach the cap.
 */
@Service
class WorkspaceStorageServiceImpl implements WorkspaceStorageService {

    private final WorkspaceStorageRepository repo;
    private final WorkspaceService workspaces;

    WorkspaceStorageServiceImpl(WorkspaceStorageRepository repo,
                                WorkspaceService workspaces) {
        this.repo = repo;
        this.workspaces = workspaces;
    }

    @Override
    @Transactional
    public void incrementOrThrow(UUID workspaceId, long delta) {
        if (delta <= 0) return;
        // FOR UPDATE serialises concurrent uploads against the same
        // workspace; without it two parallel uploads can both pass
        // the pre-check and collectively breach the cap.
        var prevBytes = repo.findForUpdate(workspaceId)
                .map(WorkspaceStorageEntity::getTotalBytes)
                .orElse(0L);

        // Pre-mutation check — checkQuota fires when current >= limit;
        // pass nextBytes - 1 so the guard rejects exactly at the cap
        // (nextBytes == limit means the new upload would push us to
        // the cap, which we treat as "already breached" for incoming
        // bytes).
        var nextBytes = prevBytes + delta;
        workspaces.checkQuota(workspaceId, "attachmentBytes",
                nextBytes - 1, WorkspaceLimits::maxAttachmentBytes);

        repo.addBytes(workspaceId, delta);
    }

    @Override
    @Transactional
    public void decrement(UUID workspaceId, long delta) {
        if (delta <= 0) return;
        repo.subtractBytes(workspaceId, delta);
    }

    @Override
    @Transactional(readOnly = true)
    public long currentBytes(UUID workspaceId) {
        // Workspace existed before V28 backfill ran (test fixtures
        // bypass migrations occasionally) — fall back to zero rather
        // than 500-erroring the upload.
        return repo.findById(workspaceId)
                .map(WorkspaceStorageEntity::getTotalBytes)
                .orElse(0L);
    }
}
