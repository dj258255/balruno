// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.project.internal;

import com.balruno.project.ProjectException;
import com.balruno.workspace.WorkspaceException;
import com.balruno.workspace.WorkspaceRole;
import com.balruno.workspace.WorkspaceService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.lang.reflect.Field;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * ProjectServiceImpl unit tests, organised across the four scenario
 * classes: Happy / Boundary / Edge / Corner. WorkspaceService is mocked
 * so the workspace authorisation pipeline is verified by argument
 * capture rather than by re-running the workspace logic.
 */
@ExtendWith(MockitoExtension.class)
class ProjectServiceImplTest {

    @Mock ProjectRepository projects;
    @Mock WorkspaceService workspaces;
    @InjectMocks ProjectServiceImpl service;

    private final UUID wsId = UUID.randomUUID();
    private final UUID otherWs = UUID.randomUUID();
    private final UUID userId = UUID.randomUUID();
    private final UUID projectId = UUID.randomUUID();

    // ── Happy ──────────────────────────────────────────────────────────

    @Nested
    @DisplayName("Happy")
    class Happy {

        @Test
        void create_inserts_with_valid_inputs() {
            when(projects.existsByWorkspaceIdAndSlugAndDeletedAtIsNull(wsId, "main")).thenReturn(false);
            when(projects.saveAndFlush(any(ProjectEntity.class)))
                    .thenAnswer(inv -> stamp(inv.getArgument(0)));

            var dto = service.create(wsId, userId, "main", "Main Project", "first one");

            assertThat(dto.workspaceId()).isEqualTo(wsId);
            assertThat(dto.slug()).isEqualTo("main");
            assertThat(dto.name()).isEqualTo("Main Project");
            assertThat(dto.description()).isEqualTo("first one");
            verify(workspaces).requireRole(wsId, userId, WorkspaceRole.BUILDER);
        }

        @Test
        void list_returns_only_active_projects_in_workspace() {
            when(projects.findByWorkspaceIdAndDeletedAtIsNullOrderByCreatedAtAsc(wsId))
                    .thenReturn(java.util.List.of(
                            stamp(new ProjectEntity(wsId, "p1", "P1", null, userId)),
                            stamp(new ProjectEntity(wsId, "p2", "P2", null, userId))));

            var dtos = service.listInWorkspace(wsId, userId);

            assertThat(dtos).hasSize(2);
            assertThat(dtos).extracting("slug").containsExactly("p1", "p2");
            verify(workspaces).requireRole(wsId, userId, WorkspaceRole.VIEWER);
        }

        @Test
        void update_renames_active_project() {
            var entity = stamp(new ProjectEntity(wsId, "main", "Main", null, userId));
            when(projects.findById(projectId)).thenReturn(Optional.of(setId(entity, projectId)));
            when(projects.saveAndFlush(any(ProjectEntity.class))).thenAnswer(inv -> inv.getArgument(0));

            var dto = service.update(projectId, userId, null, "Renamed", null);

            assertThat(dto.name()).isEqualTo("Renamed");
        }
    }

    // ── Boundary ───────────────────────────────────────────────────────

    @Nested
    @DisplayName("Boundary")
    class Boundary {

        @Test
        void create_with_min_length_slug_is_accepted() {
            when(projects.existsByWorkspaceIdAndSlugAndDeletedAtIsNull(wsId, "abc")).thenReturn(false);
            when(projects.saveAndFlush(any(ProjectEntity.class)))
                    .thenAnswer(inv -> stamp(inv.getArgument(0)));

            var dto = service.create(wsId, userId, "abc", "Three", null);

            assertThat(dto.slug()).hasSize(3);
        }

        @Test
        void create_with_max_length_slug_is_accepted() {
            var slug = "a23456789012345678901234567890"; // 30 chars
            when(projects.existsByWorkspaceIdAndSlugAndDeletedAtIsNull(wsId, slug)).thenReturn(false);
            when(projects.saveAndFlush(any(ProjectEntity.class)))
                    .thenAnswer(inv -> stamp(inv.getArgument(0)));

            var dto = service.create(wsId, userId, slug, "Max", null);

            assertThat(dto.slug()).hasSize(30);
        }

        @Test
        void create_below_BUILDER_role_throws_INSUFFICIENT_ROLE() {
            doThrow(new WorkspaceException(
                    WorkspaceException.Reason.INSUFFICIENT_ROLE,
                    "needs BUILDER"))
                    .when(workspaces).requireRole(wsId, userId, WorkspaceRole.BUILDER);

            assertThatThrownBy(() ->
                    service.create(wsId, userId, "main", "Main", null))
                    .isInstanceOfSatisfying(WorkspaceException.class, e ->
                            assertThat(e.reason()).isEqualTo(WorkspaceException.Reason.INSUFFICIENT_ROLE));
        }
    }

    // ── Edge ───────────────────────────────────────────────────────────

    @Nested
    @DisplayName("Edge")
    class Edge {

        @Test
        void findById_skips_soft_deleted_project() {
            var entity = stamp(new ProjectEntity(wsId, "main", "Main", null, userId));
            entity.softDelete();
            when(projects.findById(projectId)).thenReturn(Optional.of(setId(entity, projectId)));

            assertThatThrownBy(() -> service.findById(projectId, userId))
                    .isInstanceOfSatisfying(ProjectException.class, e ->
                            assertThat(e.reason()).isEqualTo(ProjectException.Reason.PROJECT_NOT_FOUND));
        }

        @Test
        void findById_passes_workspace_role_check_through() {
            var entity = stamp(new ProjectEntity(wsId, "main", "Main", null, userId));
            when(projects.findById(projectId)).thenReturn(Optional.of(setId(entity, projectId)));

            service.findById(projectId, userId);

            verify(workspaces).requireRole(wsId, userId, WorkspaceRole.VIEWER);
        }

        @Test
        void update_with_null_fields_is_a_noop_save() {
            var entity = stamp(new ProjectEntity(wsId, "main", "Main", "desc", userId));
            when(projects.findById(projectId)).thenReturn(Optional.of(setId(entity, projectId)));
            when(projects.saveAndFlush(any(ProjectEntity.class))).thenAnswer(inv -> inv.getArgument(0));

            var dto = service.update(projectId, userId, null, null, null);

            assertThat(dto.slug()).isEqualTo("main");
            assertThat(dto.name()).isEqualTo("Main");
            assertThat(dto.description()).isEqualTo("desc");
        }

        @Test
        void update_can_set_description_to_empty_string() {
            // null means "leave alone", empty string means "clear it". Edge
            // case in the impl's null-vs-blank branching.
            var entity = stamp(new ProjectEntity(wsId, "main", "Main", "old", userId));
            when(projects.findById(projectId)).thenReturn(Optional.of(setId(entity, projectId)));
            when(projects.saveAndFlush(any(ProjectEntity.class))).thenAnswer(inv -> inv.getArgument(0));

            var dto = service.update(projectId, userId, null, null, "");

            assertThat(dto.description()).isEmpty();
        }
    }

    // ── Corner ─────────────────────────────────────────────────────────

    @Nested
    @DisplayName("Corner")
    class Corner {

        @Test
        void same_slug_in_different_workspaces_is_allowed() {
            // The unique index is per-workspace; the second insert is
            // allowed because the existence check is workspace-scoped.
            when(projects.existsByWorkspaceIdAndSlugAndDeletedAtIsNull(wsId, "main")).thenReturn(false);
            when(projects.existsByWorkspaceIdAndSlugAndDeletedAtIsNull(otherWs, "main")).thenReturn(false);
            when(projects.saveAndFlush(any(ProjectEntity.class)))
                    .thenAnswer(inv -> stamp(inv.getArgument(0)));

            service.create(wsId, userId, "main", "WS A main", null);
            service.create(otherWs, userId, "main", "WS B main", null);

            verify(projects, org.mockito.Mockito.times(2)).saveAndFlush(any(ProjectEntity.class));
        }

        @Test
        void create_same_slug_active_throws_SLUG_TAKEN() {
            when(projects.existsByWorkspaceIdAndSlugAndDeletedAtIsNull(wsId, "main")).thenReturn(true);

            assertThatThrownBy(() -> service.create(wsId, userId, "main", "Main", null))
                    .isInstanceOfSatisfying(ProjectException.class, e ->
                            assertThat(e.reason()).isEqualTo(ProjectException.Reason.SLUG_TAKEN));
        }

        @Test
        void update_to_an_existing_slug_throws_SLUG_TAKEN() {
            var entity = stamp(new ProjectEntity(wsId, "old", "Old", null, userId));
            when(projects.findById(projectId)).thenReturn(Optional.of(setId(entity, projectId)));
            when(projects.existsByWorkspaceIdAndSlugAndDeletedAtIsNull(wsId, "taken")).thenReturn(true);

            assertThatThrownBy(() ->
                    service.update(projectId, userId, "taken", null, null))
                    .isInstanceOfSatisfying(ProjectException.class, e ->
                            assertThat(e.reason()).isEqualTo(ProjectException.Reason.SLUG_TAKEN));
        }

        @Test
        void softDelete_on_already_deleted_project_throws_PROJECT_NOT_FOUND() {
            var entity = stamp(new ProjectEntity(wsId, "main", "Main", null, userId));
            entity.softDelete();
            when(projects.findById(projectId)).thenReturn(Optional.of(setId(entity, projectId)));

            assertThatThrownBy(() -> service.softDelete(projectId, userId))
                    .isInstanceOfSatisfying(ProjectException.class, e ->
                            assertThat(e.reason()).isEqualTo(ProjectException.Reason.PROJECT_NOT_FOUND));
        }
    }

    // ── helpers ────────────────────────────────────────────────────────

    private static ProjectEntity stamp(ProjectEntity entity) {
        var now = OffsetDateTime.now(ZoneOffset.UTC);
        setField(entity, "id", UUID.randomUUID());
        setField(entity, "createdAt", now);
        setField(entity, "updatedAt", now);
        return entity;
    }

    private static ProjectEntity setId(ProjectEntity entity, UUID id) {
        setField(entity, "id", id);
        return entity;
    }

    private static void setField(Object target, String name, Object value) {
        try {
            Field f = findField(target.getClass(), name);
            f.setAccessible(true);
            f.set(target, value);
        } catch (ReflectiveOperationException e) {
            throw new AssertionError(e);
        }
    }

    private static Field findField(Class<?> clazz, String name) throws NoSuchFieldException {
        for (Class<?> c = clazz; c != null; c = c.getSuperclass()) {
            try { return c.getDeclaredField(name); } catch (NoSuchFieldException ignored) {}
        }
        throw new NoSuchFieldException(name);
    }
}
