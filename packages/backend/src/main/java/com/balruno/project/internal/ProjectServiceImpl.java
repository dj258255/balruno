// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.project.internal;

import com.balruno.project.Project;
import com.balruno.project.ProjectException;
import com.balruno.project.ProjectService;
import com.balruno.workspace.WorkspaceRole;
import com.balruno.workspace.WorkspaceService;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@Transactional
class ProjectServiceImpl implements ProjectService {

    private final ProjectRepository projects;
    private final WorkspaceService workspaces;

    ProjectServiceImpl(ProjectRepository projects, WorkspaceService workspaces) {
        this.projects = projects;
        this.workspaces = workspaces;
    }

    @Override
    public Project create(UUID workspaceId, UUID callerUserId,
                          String slug, String name, String description) {
        workspaces.requireRole(workspaceId, callerUserId, WorkspaceRole.BUILDER);
        ProjectSlugFormat.validate(slug);
        if (projects.existsByWorkspaceIdAndSlugAndDeletedAtIsNull(workspaceId, slug)) {
            throw slugTaken();
        }
        var entity = saveOrThrow(new ProjectEntity(workspaceId, slug, name, description, callerUserId));
        return toDto(entity);
    }

    @Override
    @Transactional(readOnly = true)
    public Project findById(UUID projectId, UUID callerUserId) {
        var entity = loadActive(projectId);
        workspaces.requireRole(entity.getWorkspaceId(), callerUserId, WorkspaceRole.VIEWER);
        return toDto(entity);
    }

    @Override
    @Transactional(readOnly = true)
    public List<Project> listInWorkspace(UUID workspaceId, UUID callerUserId) {
        workspaces.requireRole(workspaceId, callerUserId, WorkspaceRole.VIEWER);
        return projects.findByWorkspaceIdAndDeletedAtIsNullOrderByCreatedAtAsc(workspaceId).stream()
                .map(ProjectServiceImpl::toDto)
                .toList();
    }

    @Override
    public Project update(UUID projectId, UUID callerUserId,
                          String newSlug, String newName, String newDescription) {
        var entity = loadActive(projectId);
        workspaces.requireRole(entity.getWorkspaceId(), callerUserId, WorkspaceRole.BUILDER);
        if (newSlug != null && !newSlug.equals(entity.getSlug())) {
            ProjectSlugFormat.validate(newSlug);
            if (projects.existsByWorkspaceIdAndSlugAndDeletedAtIsNull(entity.getWorkspaceId(), newSlug)) {
                throw slugTaken();
            }
            entity.changeSlug(newSlug);
        }
        if (newName != null && !newName.isBlank() && !newName.equals(entity.getName())) {
            entity.rename(newName);
        }
        if (newDescription != null) {
            entity.changeDescription(newDescription);
        }
        return toDto(saveOrThrow(entity));
    }

    @Override
    public void softDelete(UUID projectId, UUID callerUserId) {
        var entity = loadActive(projectId);
        workspaces.requireRole(entity.getWorkspaceId(), callerUserId, WorkspaceRole.BUILDER);
        entity.softDelete();
        projects.save(entity);
    }

    // ── helpers ────────────────────────────────────────────────────────

    private ProjectEntity loadActive(UUID projectId) {
        return projects.findById(projectId)
                .filter(p -> !p.isDeleted())
                .orElseThrow(() -> new ProjectException(
                        ProjectException.Reason.PROJECT_NOT_FOUND,
                        "Project not found."));
    }

    private ProjectEntity saveOrThrow(ProjectEntity entity) {
        try {
            return projects.saveAndFlush(entity);
        } catch (DataIntegrityViolationException e) {
            throw slugTaken();
        }
    }

    private static ProjectException slugTaken() {
        return new ProjectException(
                ProjectException.Reason.SLUG_TAKEN,
                "A project with that slug already exists in this workspace.");
    }

    private static Project toDto(ProjectEntity e) {
        return new Project(
                e.getId(), e.getWorkspaceId(), e.getSlug(), e.getName(),
                e.getDescription(), e.getCreatedBy(),
                e.getCreatedAt(), e.getUpdatedAt());
    }
}
