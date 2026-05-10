// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.sync.internal;

import com.balruno.events.AfterCommitPublisher;
import com.balruno.project.ProjectException;
import com.balruno.project.ProjectService;
import com.balruno.sync.DocDuplicateApi;
import com.balruno.sync.ProjectSyncService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/**
 * Doc duplicate — sibling of {@link com.balruno.project.internal.SheetDuplicateService}
 * but for the sync module's domain. The body is a yjs binary blob in
 * the documents table (Hocuspocus side-car owns the live edit path);
 * this service only writes the new row on duplicate + grafts the
 * doc_tree leaf.
 *
 * Snapshot semantics: the cloned {@code ydoc_state} reflects the last
 * persisted snapshot at duplicate time. Hocuspocus writes
 * {@code onStoreDocument} on a throttled cadence (50 stores OR 5
 * idle minutes — see packages/collab/src/server.ts), so the duplicate
 * may lag the latest in-memory edits by up to that window. This
 * matches users' general "duplicate is a snapshot of right now-ish"
 * mental model; the alternative (force-snapshot before duplicate)
 * would couple Spring to the Node side-car and is left as a follow-up.
 */
@Service
class DocDuplicateApiImpl implements DocDuplicateApi {

    private final ProjectService projects;
    private final ProjectSyncRepository projectSync;
    private final DocumentRepository documents;
    private final ProjectSyncService sync;
    private final AfterCommitPublisher afterCommit;
    private final ObjectMapper mapper = new ObjectMapper();

    DocDuplicateApiImpl(ProjectService projects,
                        ProjectSyncRepository projectSync,
                        DocumentRepository documents,
                        ProjectSyncService sync,
                        AfterCommitPublisher afterCommit) {
        this.projects = projects;
        this.projectSync = projectSync;
        this.documents = documents;
        this.sync = sync;
        this.afterCommit = afterCommit;
    }

    @Override
    @Transactional
    public UUID duplicate(UUID projectId, UUID callerUserId, UUID sourceDocId) {
        // 1. authz — same gate ProjectService.findById applies for
        //    sheet duplicate / template import.
        projects.findById(projectId, callerUserId);

        // 2. fetch source doc (active rows only). ydoc_state is LAZY
        //    on the entity but the @Query JPQL above pulls the column
        //    into the persistence context so the getter doesn't
        //    re-issue a fetch.
        var source = documents.findActiveById(sourceDocId)
                .orElseThrow(() -> new ProjectException(
                        ProjectException.Reason.PROJECT_NOT_FOUND,
                        "doc not found: " + sourceDocId));

        // Cross-project guard — defence-in-depth. ProjectService.findById
        // already checked the caller belongs to projectId; this catches
        // a stale doc id that points at a different project.
        if (!projectId.equals(source.getProjectId())) {
            throw new ProjectException(
                    ProjectException.Reason.PROJECT_NOT_FOUND,
                    "doc not in project: " + sourceDocId);
        }

        // 3. lock + read doc_tree. Sheet duplicate locks data + sheet_tree
        //    together because cells live in projects.data; doc body is
        //    in the documents table so we only need doc_tree here.
        var state = projectSync.lockDocTreeForUpdate(projectId)
                .orElseThrow(() -> new ProjectException(
                        ProjectException.Reason.PROJECT_NOT_FOUND,
                        "project state missing: " + projectId));

        ArrayNode tree;
        UUID newDocId;
        String newName;
        ObjectNode sourceLeaf;
        try {
            tree = parseArray(state.getTreeJson());
            sourceLeaf = findLeafById(tree, sourceDocId.toString());
            // Source doc may exist in documents but not in doc_tree
            // (legacy / out-of-sync state). Fall back to title +
            // root-append rather than 404 — the row clone is the
            // load-bearing part.
            newDocId = UUID.randomUUID();
            newName = source.getTitle() + " (복사)";

            var newLeaf = mapper.createObjectNode();
            newLeaf.put("id", newDocId.toString());
            newLeaf.put("type", "doc");
            newLeaf.put("name", newName);
            // Preserve the source's icon if present in the tree leaf —
            // matches sheet-duplicate's expectation that visual
            // identity carries with the clone.
            if (sourceLeaf != null && sourceLeaf.has("icon")) {
                newLeaf.set("icon", sourceLeaf.get("icon"));
            }

            if (sourceLeaf == null || !insertLeafAfter(tree, sourceDocId.toString(), newLeaf)) {
                tree.add(newLeaf);
            }
        } catch (Exception e) {
            throw new IllegalStateException("failed to graft duplicate doc leaf", e);
        }

        // 4. clone the row. id = leaf id; slug = id-as-string (matches
        //    TreeOpService.insertDocumentShell pattern). ydoc_state
        //    is a defensive .clone() so a future mutation on the
        //    source bytes can't bleed into the clone via shared array.
        byte[] sourceState = source.getYdocState();
        byte[] copiedState = sourceState != null
                ? sourceState.clone()
                : new byte[]{0x00, 0x00};
        documents.save(new DocumentEntity(
                newDocId, projectId, newDocId.toString(), newName, copiedState));

        // 5. UPDATE doc_tree atomically. Version bumps so peers re-
        //    hydrate via sync.full and discover the clone.
        var newTreeVersion = state.getTreeVersion() + 1L;
        projectSync.updateDocTree(projectId, tree.toString(), newTreeVersion);

        // 6. afterCommit broadcast — same shape sheet duplicate uses.
        afterCommit.runAfterCommit(() -> sync.broadcastFullStateSnapshot(projectId));

        return newDocId;
    }

    private ArrayNode parseArray(String json) throws Exception {
        if (json == null) return mapper.createArrayNode();
        JsonNode parsed = mapper.readTree(json);
        return parsed.isArray() ? (ArrayNode) parsed : mapper.createArrayNode();
    }

    /** Walk the doc_tree looking for a leaf with the matching id. */
    private static ObjectNode findLeafById(ArrayNode tree, String id) {
        for (JsonNode node : tree) {
            if (!node.isObject()) continue;
            if (id.equals(node.path("id").asText())) return (ObjectNode) node;
            if (node.path("children").isArray()) {
                var found = findLeafById((ArrayNode) node.get("children"), id);
                if (found != null) return found;
            }
        }
        return null;
    }

    /**
     * Recursively walk the tree for a leaf with {@code id == sourceId}
     * and insert {@code newLeaf} right after it inside the same
     * children array. Returns true on success.
     */
    private static boolean insertLeafAfter(ArrayNode tree, String sourceId, ObjectNode newLeaf) {
        for (int i = 0; i < tree.size(); i++) {
            var node = tree.get(i);
            if (!node.isObject()) continue;
            if (sourceId.equals(node.path("id").asText())) {
                tree.insert(i + 1, newLeaf);
                return true;
            }
            if (node.path("children").isArray()) {
                if (insertLeafAfter((ArrayNode) node.get("children"), sourceId, newLeaf)) {
                    return true;
                }
            }
        }
        return false;
    }
}
