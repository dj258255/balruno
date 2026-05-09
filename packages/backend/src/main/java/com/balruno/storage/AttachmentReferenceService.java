// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.storage;

import java.util.List;
import java.util.UUID;

/**
 * Tracks which content (comment / doc / cell) references which
 * attachment blob. The pattern intentionally allows multiple refs
 * per (attachment_path, ref_kind, ref_id) tuple; ref count = 0
 * triggers blob delete + workspace counter decrement.
 *
 * Public surface so the upload + comment modules can both call.
 * Doc-body refs are recorded but never cleaned at content-edit
 * time (Y.Doc CRDT state is at Hocuspocus, not in PG); they get
 * swept indirectly via the project soft-delete cascade.
 */
public interface AttachmentReferenceService {

    enum RefKind { comment, doc, cell }

    /**
     * Record a reference at upload time. Idempotent on conflict
     * (re-upload of the same content into the same target is a no-op
     * — same hash → same path → same ref already exists).
     */
    void register(UUID workspaceId, String attachmentPath, RefKind kind, UUID refId, long sizeBytes);

    /**
     * Remove every ref a piece of content held. Returns the
     * attachment paths whose ref count *just dropped to zero* — the
     * caller is responsible for deleting those blobs from
     * StorageService and decrementing the workspace counter by the
     * total bytes those refs claimed.
     */
    List<OrphanedAttachment> removeContentRefs(RefKind kind, UUID refId);

    /** {@link #removeContentRefs} return value — one entry per now-orphan path. */
    record OrphanedAttachment(String path, long sizeBytes) {}
}
