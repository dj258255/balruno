// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.storage.internal;

import com.balruno.storage.AttachmentReferenceService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Orphan-detection service backed by {@link AttachmentReferenceRepository}.
 *
 * The contract: {@link #removeContentRefs} returns the paths whose
 * ref count *just dropped to zero* — the caller (CommentServiceImpl,
 * AttachmentCascadeListener) is responsible for actually deleting
 * the bytes from StorageService and decrementing the workspace
 * counter. Splitting concerns this way keeps the storage adapter
 * choice (R2 / LocalFs) out of this layer.
 */
@Service
class AttachmentReferenceServiceImpl implements AttachmentReferenceService {

    private final AttachmentReferenceRepository repo;

    AttachmentReferenceServiceImpl(AttachmentReferenceRepository repo) {
        this.repo = repo;
    }

    @Override
    @Transactional
    public void register(UUID workspaceId,
                         String attachmentPath,
                         RefKind kind,
                         UUID refId,
                         long sizeBytes) {
        repo.registerIfAbsent(attachmentPath, workspaceId, kind.name(), refId, sizeBytes);
    }

    @Override
    @Transactional
    public List<OrphanedAttachment> removeContentRefs(RefKind kind, UUID refId) {
        var snapshot = repo.snapshot(kind.name(), refId);
        if (snapshot.isEmpty()) return List.of();

        repo.deleteByContent(kind.name(), refId);

        var orphans = new ArrayList<OrphanedAttachment>();
        for (var row : snapshot) {
            if (repo.countByPath(row.getPath()) == 0) {
                orphans.add(new OrphanedAttachment(row.getPath(), row.getSizeBytes()));
            }
        }
        return orphans;
    }
}
