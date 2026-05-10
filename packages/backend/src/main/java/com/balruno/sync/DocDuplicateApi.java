// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.sync;

import java.util.UUID;

/**
 * Document duplicate surface — exposed by the sync module so the
 * project module's controller can offer "Duplicate" alongside the
 * sheet duplicate it already wires.
 *
 * Implementation lives in {@code sync.internal} because the documents
 * table + doc_tree column are the sync module's domain (the body is
 * a yjs binary blob the Hocuspocus side-car owns; the spring side
 * only writes the row on tree.add and the cascade soft-delete on
 * tree.delete). Keeping the duplicate path inside sync.internal
 * avoids a project → sync.internal cross-module reach.
 */
public interface DocDuplicateApi {

    /**
     * Deep-clone a doc inside the same project — copies the source's
     * {@code ydoc_state} bytes into a fresh row, names it
     * {@code "{원본} (복사)"}, and grafts a new leaf into doc_tree
     * directly after the source.
     *
     * Authz is the caller's responsibility (ProjectController calls
     * {@code projects.findById} before delegating). Sync module
     * stays one-way; it can't reach back into the project module
     * without closing a Modulith cycle.
     *
     * @throws java.util.NoSuchElementException when sourceDocId is
     *         absent or doesn't belong to projectId
     * @return the new doc id (UUID generated server-side)
     */
    UUID duplicate(UUID projectId, UUID sourceDocId);
}
