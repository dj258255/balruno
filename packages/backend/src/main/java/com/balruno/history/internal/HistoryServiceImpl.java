// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.history.internal;

import com.balruno.history.HistoryEntry;
import com.balruno.history.HistoryService;
import com.balruno.project.Project;
import com.balruno.project.ProjectService;
import com.balruno.workspace.WorkspaceLimits;
import com.balruno.workspace.WorkspaceRole;
import com.balruno.workspace.WorkspaceService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Service
@Transactional(readOnly = true)
class HistoryServiceImpl implements HistoryService {

    private final HistoryRepository repo;
    private final ProjectService projects;
    private final WorkspaceService workspaces;

    HistoryServiceImpl(HistoryRepository repo, ProjectService projects, WorkspaceService workspaces) {
        this.repo = repo;
        this.projects = projects;
        this.workspaces = workspaces;
    }

    @Override
    public List<HistoryEntry> listForRow(UUID projectId, UUID sheetId, UUID rowId,
                                         UUID callerUserId, int limit) {
        var cutoff = authorisedCutoff(projectId, callerUserId);
        return repo.listForRow(projectId, sheetId, rowId, cutoff, clampLimit(limit));
    }

    @Override
    public List<HistoryEntry> listForSheet(UUID projectId, UUID sheetId,
                                           UUID callerUserId, int limit) {
        var cutoff = authorisedCutoff(projectId, callerUserId);
        return repo.listForSheet(projectId, sheetId, cutoff, clampLimit(limit));
    }

    /**
     * Auth + retention cutoff in one helper. Throws if the caller
     * isn't a Viewer+ on the project's workspace; otherwise returns
     * the OffsetDateTime past which rows are still user-visible.
     */
    private OffsetDateTime authorisedCutoff(UUID projectId, UUID callerUserId) {
        Project project = projects.findById(projectId, callerUserId);
        var ws = workspaces.findById(project.workspaceId());
        workspaces.requireRole(ws.id(), callerUserId, WorkspaceRole.VIEWER);
        var days = WorkspaceLimits.forPlan(ws.plan()).historyRetentionDays();
        return OffsetDateTime.now().minusDays(Math.max(1, days));
    }

    private static int clampLimit(int requested) {
        if (requested <= 0) return 100;
        return Math.min(requested, 500);
    }
}
