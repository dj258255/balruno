// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.storage;

import java.util.UUID;

/**
 * Per-workspace cumulative byte counter for the attachment quota
 * ({@link com.balruno.workspace.WorkspaceLimits#maxAttachmentBytes()}).
 *
 * The pattern intentionally separates the COUNTER from the storage
 * adapter — R2 listing or filesystem traversal would work as a
 * source of truth but cost an op per upload. A single-row counter
 * mutated in the same transaction as the upload write keeps quota
 * checks O(1).
 *
 * Public surface so the upload module + quota module can both call
 * in. Modulith arch test enforces that no other module touches the
 * underlying table directly.
 */
public interface WorkspaceStorageService {

    /**
     * Reserve {@code delta} bytes for an upload that's about to
     * happen. Throws {@link com.balruno.workspace.QuotaException}
     * if the post-mutation total would exceed the workspace's plan
     * cap.
     *
     * Implementations must use SELECT ... FOR UPDATE (or an
     * equivalent) so two concurrent uploads can't both pass the
     * pre-check and collectively breach the cap.
     */
    void incrementOrThrow(UUID workspaceId, long delta);

    /**
     * Release {@code delta} bytes when an attachment is deleted.
     * Clamps to zero so accounting drift can't push the counter
     * negative; reconciliation against R2 listing is a separate
     * housekeeping task.
     */
    void decrement(UUID workspaceId, long delta);

    /** Current cumulative bytes used by a workspace. */
    long currentBytes(UUID workspaceId);
}
