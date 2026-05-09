// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.history.internal;

import com.balruno.history.DocSnapshot;
import com.balruno.history.DocSnapshotService;
import com.balruno.project.Project;
import com.balruno.project.ProjectService;
import com.balruno.workspace.WorkspaceLimits;
import com.balruno.workspace.WorkspaceRole;
import com.balruno.workspace.WorkspaceService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
@Transactional(readOnly = true)
class DocSnapshotServiceImpl implements DocSnapshotService {

    private final DocSnapshotRepository repo;
    private final ProjectService projects;
    private final WorkspaceService workspaces;

    DocSnapshotServiceImpl(DocSnapshotRepository repo,
                           ProjectService projects,
                           WorkspaceService workspaces) {
        this.repo = repo;
        this.projects = projects;
        this.workspaces = workspaces;
    }

    @Override
    public List<DocSnapshot> listForDoc(UUID docId, UUID callerUserId, int limit) {
        var projectId = repo.findProjectIdForDoc(docId).orElse(null);
        if (projectId == null) return Collections.emptyList();
        var cutoff = authorisedCutoff(projectId, callerUserId);
        return repo.listForDoc(docId, cutoff, clampLimit(limit));
    }

    @Override
    public Optional<byte[]> readState(UUID snapshotId, UUID callerUserId) {
        var meta = repo.findById(snapshotId).orElse(null);
        if (meta == null) return Optional.empty();
        // Auth check before pulling the BYTEA — saves a wasted read on
        // a stranger probing the snapshot id.
        try {
            authorisedCutoff(meta.projectId(), callerUserId);
        } catch (RuntimeException e) {
            return Optional.empty();
        }
        return repo.findStateBytes(snapshotId);
    }

    private OffsetDateTime authorisedCutoff(UUID projectId, UUID callerUserId) {
        Project project = projects.findById(projectId, callerUserId);
        var ws = workspaces.findById(project.workspaceId());
        workspaces.requireRole(ws.id(), callerUserId, WorkspaceRole.VIEWER);
        var days = WorkspaceLimits.forPlan(ws.plan()).historyRetentionDays();
        return OffsetDateTime.now().minusDays(Math.max(1, days));
    }

    private static int clampLimit(int requested) {
        if (requested <= 0) return 50;
        return Math.min(requested, 200);
    }
}
