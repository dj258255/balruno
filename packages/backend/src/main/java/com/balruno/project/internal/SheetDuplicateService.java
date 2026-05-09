// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.project.internal;

import com.balruno.project.ProjectException;
import com.balruno.project.ProjectService;
import com.balruno.sync.ProjectSyncService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.UUID;

/**
 * Sidebar context-menu 시트 복제. Source sheet 를 통째로 deep-clone 하면서
 * sheet / column / row id 를 모두 새로 부여하고, 트리에서도 source leaf 의
 * 직접 부모 안에 같은 위치 + 1 로 새 leaf 를 끼운다. 이름은 "{원본} (복사)"
 * 패턴.
 *
 * <p>{@link TemplateImportService} 와 동일한 lock-mutate-broadcast 패턴.
 * data + sheet_tree 를 같은 UPDATE 로 묶어 두 채널의 version 이 한 번에
 * 올라가게 하고, afterCommit 에서 sync.full 을 다시 broadcast 해서 peer
 * 들이 새 시트를 자동으로 보게 한다.</p>
 */
@Service
class SheetDuplicateService {

    private final JdbcTemplate jdbc;
    private final ProjectService projects;
    private final ProjectSyncService sync;
    private final ObjectMapper mapper = new ObjectMapper();

    SheetDuplicateService(JdbcTemplate jdbc, ProjectService projects, ProjectSyncService sync) {
        this.jdbc = jdbc;
        this.projects = projects;
        this.sync = sync;
    }

    /** Returns the id of the newly inserted duplicate sheet. */
    @Transactional
    UUID duplicate(UUID projectId, UUID callerUserId, UUID sourceSheetId) {
        // authz — same gate TemplateImportService uses.
        projects.findById(projectId, callerUserId);

        ProjectState state;
        try {
            state = jdbc.queryForObject(
                    "SELECT data::text AS data_json, data_version, "
                  + "sheet_tree::text AS sheet_tree_json, sheet_tree_version "
                  + "FROM projects WHERE id = ? AND deleted_at IS NULL FOR UPDATE",
                    (rs, i) -> new ProjectState(
                            rs.getString("data_json"),
                            rs.getLong("data_version"),
                            rs.getString("sheet_tree_json"),
                            rs.getLong("sheet_tree_version")),
                    projectId);
        } catch (EmptyResultDataAccessException e) {
            throw new ProjectException(
                    ProjectException.Reason.PROJECT_NOT_FOUND,
                    "project state missing: " + projectId);
        }

        ArrayNode sheets;
        ArrayNode tree;
        UUID newSheetId;
        try {
            sheets = parseArray(state.dataJson);
            tree = parseArray(state.sheetTreeJson);

            var sourceIdStr = sourceSheetId.toString();
            ObjectNode source = null;
            int sourceIndex = -1;
            for (int i = 0; i < sheets.size(); i++) {
                var node = sheets.get(i);
                if (node.isObject() && sourceIdStr.equals(node.path("id").asText())) {
                    source = (ObjectNode) node;
                    sourceIndex = i;
                    break;
                }
            }
            if (source == null) {
                // Reuse PROJECT_NOT_FOUND mapping (404) — adding a
                // dedicated SHEET_NOT_FOUND reason would expand the
                // public exception surface for one corner case.
                throw new ProjectException(
                        ProjectException.Reason.PROJECT_NOT_FOUND,
                        "sheet not found in project: " + sourceSheetId);
            }

            var clone = (ObjectNode) source.deepCopy();
            newSheetId = UUID.randomUUID();
            clone.put("id", newSheetId.toString());
            // Re-id columns + rows so peer caches don't collide on existing
            // ids from the source sheet.
            if (clone.has("columns") && clone.get("columns").isArray()) {
                for (JsonNode col : clone.get("columns")) {
                    if (col.isObject()) ((ObjectNode) col).put("id", UUID.randomUUID().toString());
                }
            }
            if (clone.has("rows") && clone.get("rows").isArray()) {
                for (JsonNode row : clone.get("rows")) {
                    if (row.isObject()) ((ObjectNode) row).put("id", UUID.randomUUID().toString());
                }
            }
            clone.put("name", source.path("name").asText() + " (복사)");
            var now = System.currentTimeMillis();
            clone.put("createdAt", now);
            clone.put("updatedAt", now);

            sheets.insert(sourceIndex + 1, clone);

            // Find source leaf in the sheet_tree and graft a new leaf
            // immediately after it. Falls back to root when the source
            // leaf is absent (legacy projects with empty sheet_tree).
            var newLeaf = mapper.createObjectNode();
            newLeaf.put("id", newSheetId.toString());
            newLeaf.put("type", "sheet");
            newLeaf.put("name", clone.path("name").asText());
            if (!insertLeafAfter(tree, sourceIdStr, newLeaf)) {
                tree.add(newLeaf);
            }
        } catch (ProjectException e) {
            throw e;
        } catch (Exception e) {
            throw new IllegalStateException("failed to duplicate sheet", e);
        }

        var newDataVersion = state.dataVersion + 1L;
        var newTreeVersion = state.sheetTreeVersion + 1L;
        jdbc.update(
                "UPDATE projects SET data = ?::jsonb, data_version = ?, "
              + "sheet_tree = ?::jsonb, sheet_tree_version = ?, updated_at = now() "
              + "WHERE id = ?",
                sheets.toString(), newDataVersion,
                tree.toString(), newTreeVersion,
                projectId);

        TransactionSynchronizationManager.registerSynchronization(
                new TransactionSynchronization() {
                    @Override
                    public void afterCommit() {
                        sync.broadcastFullStateSnapshot(projectId);
                    }
                });

        return newSheetId;
    }

    /**
     * Recursively walks the tree looking for a leaf with {@code id ==
     * sourceId} and inserts {@code newLeaf} right after it inside the
     * same children array. Returns true on success, false when the
     * source leaf is absent so the caller can fall back to a root append.
     */
    private boolean insertLeafAfter(ArrayNode tree, String sourceId, ObjectNode newLeaf) {
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

    private ArrayNode parseArray(String json) throws Exception {
        if (json == null) return mapper.createArrayNode();
        JsonNode parsed = mapper.readTree(json);
        return parsed.isArray() ? (ArrayNode) parsed : mapper.createArrayNode();
    }

    private record ProjectState(
            String dataJson, long dataVersion,
            String sheetTreeJson, long sheetTreeVersion
    ) {}
}
