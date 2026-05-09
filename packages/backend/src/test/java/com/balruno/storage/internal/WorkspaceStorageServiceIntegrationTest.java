// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.storage.internal;

import com.balruno.TestcontainersConfig;
import com.balruno.storage.WorkspaceStorageService;
import com.balruno.workspace.QuotaException;
import com.balruno.workspace.Workspace;
import com.balruno.workspace.WorkspacePlan;
import com.balruno.workspace.WorkspaceService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.junit.jupiter.SpringExtension;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

/**
 * Integration tests for the workspace_storage counter (ADR 0024 + Phase D).
 * Postgres via Testcontainers — covers the FOR UPDATE-protected
 * read-modify-write that prevents two concurrent uploads from
 * collectively breaching the per-plan attachment cap.
 */
@ExtendWith(SpringExtension.class)
@SpringBootTest
@Import(TestcontainersConfig.class)
class WorkspaceStorageServiceIntegrationTest {

    @Autowired WorkspaceStorageService storageCounter;
    @Autowired JdbcTemplate jdbc;
    @MockitoBean WorkspaceService workspaceService;

    @Test
    @Transactional
    void incrementAccumulatesAndQueriesBack() {
        var workspaceId = seedWorkspace(WorkspacePlan.FREE);

        storageCounter.incrementOrThrow(workspaceId, 1024);
        storageCounter.incrementOrThrow(workspaceId, 2048);

        assertThat(storageCounter.currentBytes(workspaceId)).isEqualTo(3072);
    }

    @Test
    @Transactional
    void decrementClampsToZero() {
        var workspaceId = seedWorkspace(WorkspacePlan.FREE);

        storageCounter.incrementOrThrow(workspaceId, 1000);
        storageCounter.decrement(workspaceId, 5_000); // overflow

        assertThat(storageCounter.currentBytes(workspaceId)).isZero();
    }

    @Test
    @Transactional
    void incrementAtCapThrowsQuotaException() {
        // FREE = 200MB cumulative cap (WorkspaceLimits).
        var workspaceId = seedWorkspace(WorkspacePlan.FREE);
        var freeBytes = 200L * 1024 * 1024;

        // Land just under the cap.
        storageCounter.incrementOrThrow(workspaceId, freeBytes - 1);

        // Next 2-byte upload tips it over the edge — must reject.
        assertThatThrownBy(() -> storageCounter.incrementOrThrow(workspaceId, 2))
                .isInstanceOf(QuotaException.class);
    }

    @Test
    @Transactional
    void incrementExactlyAtCapRejected() {
        // Exactly hitting the cap is also a refusal — `requireBelow`
        // semantics are strict-less-than.
        var workspaceId = seedWorkspace(WorkspacePlan.FREE);
        var freeBytes = 200L * 1024 * 1024;

        assertThatThrownBy(() -> storageCounter.incrementOrThrow(workspaceId, freeBytes))
                .isInstanceOf(QuotaException.class);
    }

    @Test
    @Transactional
    void zeroOrNegativeDeltaIgnored() {
        var workspaceId = seedWorkspace(WorkspacePlan.FREE);

        storageCounter.incrementOrThrow(workspaceId, 0);
        storageCounter.incrementOrThrow(workspaceId, -1);
        storageCounter.decrement(workspaceId, 0);
        storageCounter.decrement(workspaceId, -1);

        assertThat(storageCounter.currentBytes(workspaceId)).isZero();
    }

    @Test
    @Transactional
    void currentBytesForUnknownWorkspaceReturnsZero() {
        // Absent workspace_storage row (test fixture / pre-V28 backfill
        // edge) returns 0 instead of 500-erroring.
        assertThat(storageCounter.currentBytes(UUID.randomUUID())).isZero();
    }

    @Test
    @Transactional
    void proPlanGetsLargerCap() {
        // PRO = 5GB cumulative. FREE-cap-breaching delta succeeds on PRO.
        var workspaceId = seedWorkspace(WorkspacePlan.PRO);
        var freeBytes = 200L * 1024 * 1024;

        // Way past FREE cap, well inside PRO cap.
        storageCounter.incrementOrThrow(workspaceId, freeBytes + 1024);
        assertThat(storageCounter.currentBytes(workspaceId)).isEqualTo(freeBytes + 1024);
    }

    /**
     * Seeds a workspace + workspace_storage row + mocks the
     * WorkspaceService.findById call the service uses to look up the
     * plan. Returns the workspace id.
     */
    private UUID seedWorkspace(WorkspacePlan plan) {
        var id = UUID.randomUUID();
        var slug = "ws-" + id.toString().substring(0, 8);
        jdbc.update(
                "INSERT INTO workspaces (id, slug, name, plan, created_by) "
              + "VALUES (?, ?, ?, ?::workspace_plan, ?)",
                id, slug, "test", plan.name(), seedUser());
        jdbc.update("INSERT INTO workspace_storage (workspace_id, total_bytes) VALUES (?, 0)", id);

        var ws = new Workspace(
                id, slug, "test", plan,
                UUID.randomUUID(), OffsetDateTime.now(), OffsetDateTime.now());
        when(workspaceService.findById(any())).thenReturn(ws);
        return id;
    }

    private UUID seedUser() {
        var id = UUID.randomUUID();
        jdbc.update(
                "INSERT INTO users (id, email, email_verified) "
              + "VALUES (?, ?, true)",
                id, "u-" + id + "@test");
        return id;
    }
}
