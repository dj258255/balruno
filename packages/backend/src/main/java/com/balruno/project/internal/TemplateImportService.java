// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.project.internal;

import com.balruno.project.ProjectException;
import com.balruno.project.ProjectService;
import com.balruno.sync.ProjectSyncService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/**
 * Stage F — "Add from template" backend. Atomically grafts a starter
 * pack group's sheets onto an existing project: every sheet in the
 * group is appended to {@code projects.data}, a fresh folder
 * (carrying the group's display name) is appended to {@code
 * projects.sheet_tree} with one leaf per imported sheet, and both
 * versions bump in the same UPDATE so peers can never observe a
 * leaf without its sheet body.
 *
 * After the @Transactional method commits, every WebSocket session
 * registered against the project receives a fresh {@code sync.full}
 * frame so peer states grow without requiring a manual refresh. The
 * broadcast is deferred to {@link TransactionSynchronization#afterCommit}
 * so a rolled-back tx can never trigger a misleading hydrate.
 *
 * Authorisation goes through {@link ProjectService#findById} which
 * throws {@code ProjectException.NotFound} when the caller isn't a
 * member of the project's workspace. The mutation itself never sees
 * an unauthorised caller.
 */
@Service
class TemplateImportService {

    private final ProjectRepository projectRepo;
    private final StarterPackSeeder seeder;
    private final ProjectService projects;
    private final ProjectSyncService sync;
    private final com.balruno.events.AfterCommitPublisher afterCommit;
    private final ObjectMapper mapper = new ObjectMapper();

    TemplateImportService(ProjectRepository projectRepo,
                          StarterPackSeeder seeder,
                          ProjectService projects,
                          ProjectSyncService sync,
                          com.balruno.events.AfterCommitPublisher afterCommit) {
        this.projectRepo = projectRepo;
        this.seeder = seeder;
        this.projects = projects;
        this.sync = sync;
        this.afterCommit = afterCommit;
    }

    /**
     * Lists what the caller can import — same shape as the modal
     * needs. {@code locale} drives the name/description language;
     * unknown locales fall back to {@code ko} (the source language
     * STARTER_CATALOG was authored in).
     */
    List<StarterPackSeeder.GroupSummary> listGroups(String locale) {
        return seeder.listGroups(locale);
    }

    @Transactional
    void apply(UUID projectId, UUID userId, String groupId, String locale) {
        // 1. authz — ProjectService.findById throws ProjectException
        //    (PROJECT_NOT_FOUND) for non-members or missing ids.
        projects.findById(projectId, userId);

        // 2. fetch group from catalog. listGroups() / buildGroup() share
        //    the same locale fallback (ko if exact match missing).
        var group = seeder.buildGroup(locale, groupId);
        if (group == null) {
            throw new IllegalArgumentException("starter pack group not found: " + groupId);
        }

        // 3. lock + read project state we're about to mutate. Same
        //    pattern as TreeOpService / SheetCellOpService — the
        //    projects row is the serialisation point.
        var state = projectRepo.lockDataAndSheetTreeForUpdate(projectId)
                .orElseThrow(() -> new ProjectException(
                        ProjectException.Reason.PROJECT_NOT_FOUND,
                        "project state missing: " + projectId));

        // 4. mutate JSON in Java: append group's sheets to data, append
        //    a fresh folder + leaves to sheet_tree. Folder UUID is
        //    regenerated per import so two imports of the same group
        //    don't collide on tree id.
        ArrayNode sheets, tree;
        try {
            sheets = parseArray(state.getDataJson());
            tree = parseArray(state.getSheetTreeJson());
            for (var sheet : group.sheets()) {
                sheets.add(sheet.deepCopy());
            }
            var folder = mapper.createObjectNode();
            folder.put("id", UUID.randomUUID().toString());
            folder.put("type", "folder");
            folder.put("name", group.name());
            var leaves = mapper.createArrayNode();
            for (var leaf : group.sheetLeaves()) {
                leaves.add(leaf.deepCopy());
            }
            folder.set("children", leaves);
            tree.add(folder);
        } catch (Exception e) {
            throw new IllegalStateException("failed to apply template import", e);
        }

        // 5. single UPDATE bumps both versions atomically so any peer
        //    re-hydrate sees a coherent (data, sheet_tree) snapshot.
        var newDataVersion = state.getDataVersion() + 1L;
        var newTreeVersion = state.getSheetTreeVersion() + 1L;
        projectRepo.updateDataAndSheetTree(projectId,
                sheets.toString(), newDataVersion,
                tree.toString(), newTreeVersion);

        // 6. afterCommit broadcast — peers re-hydrate via sync.full so
        //    the new sheets appear without a manual reload. Inside the
        //    tx the broadcast would race against an uncommitted state
        //    (peers could read the OLD state via their own SELECTs).
        afterCommit.runAfterCommit(() -> sync.broadcastFullStateSnapshot(projectId));
    }

    private ArrayNode parseArray(String json) throws Exception {
        if (json == null) return mapper.createArrayNode();
        JsonNode parsed = mapper.readTree(json);
        return parsed.isArray() ? (ArrayNode) parsed : mapper.createArrayNode();
    }
}
