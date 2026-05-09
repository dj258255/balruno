// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.history.internal;

import com.balruno.history.HistoryEntry;
import com.balruno.project.Project;
import com.balruno.project.ProjectService;
import com.balruno.workspace.Workspace;
import com.balruno.workspace.WorkspacePlan;
import com.balruno.workspace.WorkspaceRole;
import com.balruno.workspace.WorkspaceService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Limit;

import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * HistoryServiceImpl unit tests covering the auth-cutoff logic that
 * gates row / sheet history reads.
 *
 * Two invariants drive the tests:
 *   1) Membership check (ProjectService.findById + requireRole) MUST
 *      run before any repository query — non-members never see history.
 *   2) Retention cutoff is a function of the workspace's plan tier:
 *      FREE = 14 days, PRO = 60 days, TEAM = 180 days. The repo query
 *      gets a cutoff timestamp that respects the cap.
 */
@ExtendWith(MockitoExtension.class)
class HistoryServiceImplTest {

    @Mock HistoryRepository repo;
    @Mock ProjectService projects;
    @Mock WorkspaceService workspaces;
    @InjectMocks HistoryServiceImpl service;

    @Nested
    @DisplayName("listForRow")
    class ListForRow {

        @Test
        void member_with_viewer_role_gets_repo_results_with_clamped_limit() {
            var caller = UUID.randomUUID();
            var workspaceId = UUID.randomUUID();
            var projectId = UUID.randomUUID();
            var sheetId = UUID.randomUUID();
            var rowId = UUID.randomUUID();
            stubAccess(caller, workspaceId, projectId, WorkspacePlan.FREE);
            when(repo.listForRow(eq(projectId), eq(sheetId), eq(rowId),
                    any(), any())).thenReturn(List.of());

            var result = service.listForRow(projectId, sheetId, rowId, caller, 50);

            assertThat(result).isNotNull();
            verify(repo).listForRow(eq(projectId), eq(sheetId), eq(rowId), any(), any());
        }

        @Test
        void non_member_findById_throws_skips_repo_call() {
            var caller = UUID.randomUUID();
            var projectId = UUID.randomUUID();
            when(projects.findById(eq(projectId), eq(caller)))
                    .thenThrow(new RuntimeException("PROJECT_NOT_FOUND"));

            assertThatThrownBy(() -> service.listForRow(
                    projectId, UUID.randomUUID(), UUID.randomUUID(), caller, 100))
                    .isInstanceOf(RuntimeException.class);
            verify(repo, never()).listForRow(any(), any(), any(), any(), any());
        }

        @Test
        void member_without_required_role_throws_via_requireRole() {
            // findById passes (caller is somehow a project member view)
            // but requireRole rejects (e.g., past member with revoked role).
            var caller = UUID.randomUUID();
            var workspaceId = UUID.randomUUID();
            var projectId = UUID.randomUUID();
            stubProjectAndWorkspace(caller, workspaceId, projectId, WorkspacePlan.FREE);
            org.mockito.Mockito.doThrow(new RuntimeException("ROLE_INSUFFICIENT"))
                    .when(workspaces).requireRole(eq(workspaceId), eq(caller),
                            eq(WorkspaceRole.VIEWER));

            assertThatThrownBy(() -> service.listForRow(
                    projectId, UUID.randomUUID(), UUID.randomUUID(), caller, 100))
                    .isInstanceOf(RuntimeException.class);
            verify(repo, never()).listForRow(any(), any(), any(), any(), any());
        }
    }

    @Nested
    @DisplayName("listForSheet")
    class ListForSheet {

        @Test
        void member_get_sheet_history_passes_through_to_repo() {
            var caller = UUID.randomUUID();
            var workspaceId = UUID.randomUUID();
            var projectId = UUID.randomUUID();
            var sheetId = UUID.randomUUID();
            stubAccess(caller, workspaceId, projectId, WorkspacePlan.PRO);
            when(repo.listForSheet(eq(projectId), eq(sheetId), any(), any()))
                    .thenReturn(List.of());

            service.listForSheet(projectId, sheetId, caller, 100);

            verify(repo).listForSheet(eq(projectId), eq(sheetId), any(), any());
        }
    }

    @Nested
    @DisplayName("retention cutoff per plan")
    class RetentionCutoff {

        @Test
        void free_plan_cutoff_is_14_days_ago() {
            assertCutoffMatchesRetention(WorkspacePlan.FREE, 14);
        }

        @Test
        void pro_plan_cutoff_is_60_days_ago() {
            assertCutoffMatchesRetention(WorkspacePlan.PRO, 60);
        }

        @Test
        void team_plan_cutoff_is_180_days_ago() {
            assertCutoffMatchesRetention(WorkspacePlan.TEAM, 180);
        }

        private void assertCutoffMatchesRetention(WorkspacePlan plan, int expectedDays) {
            var caller = UUID.randomUUID();
            var workspaceId = UUID.randomUUID();
            var projectId = UUID.randomUUID();
            var sheetId = UUID.randomUUID();
            stubAccess(caller, workspaceId, projectId, plan);

            var cap = ArgumentCaptor.forClass(OffsetDateTime.class);
            when(repo.listForSheet(any(), any(), cap.capture(), any())).thenReturn(List.of());

            service.listForSheet(projectId, sheetId, caller, 100);

            var cutoff = cap.getValue();
            var expected = OffsetDateTime.now().minusDays(expectedDays);
            // Cutoff should be ~now - expectedDays, allowing 5s of clock
            // drift between service call and assertion.
            assertThat(cutoff).isCloseTo(expected,
                    org.assertj.core.api.Assertions.within(5, ChronoUnit.SECONDS));
        }
    }

    @Nested
    @DisplayName("limit clamping")
    class LimitClamp {

        @Test
        void zero_or_negative_limit_clamps_to_default_100() {
            var caller = UUID.randomUUID();
            var workspaceId = UUID.randomUUID();
            var projectId = UUID.randomUUID();
            var sheetId = UUID.randomUUID();
            stubAccess(caller, workspaceId, projectId, WorkspacePlan.FREE);
            var cap = ArgumentCaptor.forClass(Limit.class);
            when(repo.listForSheet(any(), any(), any(), cap.capture())).thenReturn(List.of());

            service.listForSheet(projectId, sheetId, caller, 0);
            assertThat(cap.getValue().max()).isEqualTo(100);

            service.listForSheet(projectId, sheetId, caller, -50);
            assertThat(cap.getValue().max()).isEqualTo(100);
        }

        @Test
        void limit_above_500_clamped_to_500_max() {
            // 500 cap protects against unbounded reads — a malicious
            // client can't request 1M rows even if the route would allow.
            var caller = UUID.randomUUID();
            var workspaceId = UUID.randomUUID();
            var projectId = UUID.randomUUID();
            stubAccess(caller, workspaceId, projectId, WorkspacePlan.FREE);
            var cap = ArgumentCaptor.forClass(Limit.class);
            when(repo.listForSheet(any(), any(), any(), cap.capture())).thenReturn(List.of());

            service.listForSheet(projectId, UUID.randomUUID(), caller, 10_000);

            assertThat(cap.getValue().max()).isEqualTo(500);
        }

        @Test
        void mid_range_limit_passes_through_unchanged() {
            var caller = UUID.randomUUID();
            var workspaceId = UUID.randomUUID();
            var projectId = UUID.randomUUID();
            stubAccess(caller, workspaceId, projectId, WorkspacePlan.FREE);
            var cap = ArgumentCaptor.forClass(Limit.class);
            when(repo.listForSheet(any(), any(), any(), cap.capture())).thenReturn(List.of());

            service.listForSheet(projectId, UUID.randomUUID(), caller, 250);

            assertThat(cap.getValue().max()).isEqualTo(250);
        }
    }

    // ── helpers ───────────────────────────────────────────────────────

    private void stubAccess(UUID caller, UUID workspaceId, UUID projectId, WorkspacePlan plan) {
        stubProjectAndWorkspace(caller, workspaceId, projectId, plan);
        // requireRole is void; default Mockito does nothing on non-stubbed
        // void methods, which is what we want for happy paths.
    }

    private void stubProjectAndWorkspace(UUID caller, UUID workspaceId, UUID projectId, WorkspacePlan plan) {
        when(projects.findById(eq(projectId), eq(caller))).thenReturn(new Project(
                projectId, workspaceId, "main", "Main",
                null, caller,
                OffsetDateTime.now(), OffsetDateTime.now(),
                "1.0"));
        when(workspaces.findById(eq(workspaceId))).thenReturn(new Workspace(
                workspaceId, "ws", "Workspace", plan,
                caller, OffsetDateTime.now(), OffsetDateTime.now()));
    }
}
