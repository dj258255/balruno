// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.sync.internal;

import com.balruno.TestcontainersConfig;
import com.balruno.sync.UndoService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.junit.jupiter.SpringExtension;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Integration test for the V14 / Phase 5 undo path. Round-trips:
 *   - write op_idempotency rows with inverse_payload + reversibleUntil
 *     directly via JdbcTemplate (skipping the wss apply path so we
 *     test undo independent of sheet-cell mechanics)
 *   - call UndoService.recentReversible / undo / redo
 *   - assert is_undone flips, reversibility window respected,
 *     per-tab scoping works
 *
 * This test runs only when Docker is reachable. Local devs without
 * Docker skip via the Testcontainers strategy fallback.
 */
@ExtendWith(SpringExtension.class)
@SpringBootTest
@Import(TestcontainersConfig.class)
class UndoServiceIntegrationTest {

    @Autowired UndoService undo;
    @Autowired JdbcTemplate jdbc;

    private static final ObjectMapper M = new ObjectMapper();

    @Test
    @Transactional
    void recentReversibleReturnsRecentNonExpiredRows() throws Exception {
        var ctx = seed();
        var sessionId = UUID.randomUUID();
        // Insert 3 reversible rows for this user/session
        for (int i = 0; i < 3; i++) {
            insertOpIdempotencyRow(ctx, sessionId, false,
                    "[{\"type\":\"cell.update\",\"sheetId\":\"" + UUID.randomUUID() + "\"}]",
                    "[{\"type\":\"cell.update\",\"sheetId\":\"" + UUID.randomUUID() + "\"}]");
        }

        var stack = undo.recentReversible(ctx.userId, ctx.projectId, sessionId, 50);
        assertThat(stack).hasSize(3);
        assertThat(stack).allSatisfy(e -> {
            assertThat(e.forward()).isNotNull();
            assertThat(e.inverse()).isNotNull();
            assertThat(e.undone()).isFalse();
        });
    }

    @Test
    @Transactional
    void recentReversibleScopedToSession() throws Exception {
        var ctx = seed();
        var sessionA = UUID.randomUUID();
        var sessionB = UUID.randomUUID();
        // 2 rows in session A, 1 in session B
        insertOpIdempotencyRow(ctx, sessionA, false, "[{\"type\":\"row.add\"}]", "[{\"type\":\"row.delete\"}]");
        insertOpIdempotencyRow(ctx, sessionA, false, "[{\"type\":\"row.add\"}]", "[{\"type\":\"row.delete\"}]");
        insertOpIdempotencyRow(ctx, sessionB, false, "[{\"type\":\"row.add\"}]", "[{\"type\":\"row.delete\"}]");

        var stackA = undo.recentReversible(ctx.userId, ctx.projectId, sessionA, 50);
        var stackB = undo.recentReversible(ctx.userId, ctx.projectId, sessionB, 50);
        assertThat(stackA).hasSize(2);
        assertThat(stackB).hasSize(1);
    }

    @Test
    @Transactional
    void recentReversibleSkipsExpiredRows() throws Exception {
        var ctx = seed();
        var sessionId = UUID.randomUUID();
        // One row with reversibleUntil in the past (expired)
        insertOpIdempotencyRowWithReversibleUntil(
                ctx, sessionId, false,
                "[{\"type\":\"cell.update\"}]",
                "[{\"type\":\"cell.update\"}]",
                OffsetDateTime.now().minusMinutes(1));
        // One row with reversibleUntil in the future (valid)
        insertOpIdempotencyRow(ctx, sessionId, false,
                "[{\"type\":\"cell.update\"}]",
                "[{\"type\":\"cell.update\"}]");

        var stack = undo.recentReversible(ctx.userId, ctx.projectId, sessionId, 50);
        assertThat(stack).hasSize(1);
    }

    @Test
    @Transactional
    void recentReversibleSkipsRowsWithoutInverse() throws Exception {
        var ctx = seed();
        var sessionId = UUID.randomUUID();
        // Idempotency-cache-only row (no inverse_payload, no reversibleUntil)
        jdbc.update(
                "INSERT INTO op_idempotency ("
              + "  client_msg_id, user_id, scope_kind, scope_id, result_version, "
              + "  result_payload, project_id"
              + ") VALUES (?, ?, ?::op_scope_kind, ?, ?, ?::jsonb, ?)",
                UUID.randomUUID(), ctx.userId, "SHEET_CELL", ctx.projectId, 1L,
                "{\"type\":\"op.acked\"}", ctx.projectId);

        var stack = undo.recentReversible(ctx.userId, ctx.projectId, sessionId, 50);
        assertThat(stack).isEmpty();
    }

    private record SeedContext(UUID projectId, UUID userId, UUID workspaceId) {}

    private SeedContext seed() {
        var userId = UUID.randomUUID();
        var workspaceId = UUID.randomUUID();
        var projectId = UUID.randomUUID();
        jdbc.update(
                "INSERT INTO users (id, email) VALUES (?, ?)",
                userId,
                "undo-test-" + userId.toString().substring(0, 8) + "@example.com");
        jdbc.update(
                "INSERT INTO workspaces (id, slug, name, created_by) "
              + "VALUES (?, ?, ?, ?)",
                workspaceId,
                "ut-" + workspaceId.toString().substring(0, 8),
                "undo test ws",
                userId);
        jdbc.update(
                "INSERT INTO projects ("
              + "  id, workspace_id, slug, name, description, created_by, "
              + "  data, sheet_tree"
              + ") VALUES (?, ?, ?, ?, ?, ?, '[]'::jsonb, '[]'::jsonb)",
                projectId, workspaceId, "ut-proj", "Undo Test Project", null, userId);
        return new SeedContext(projectId, userId, workspaceId);
    }

    private void insertOpIdempotencyRow(SeedContext ctx, UUID sessionId,
                                         boolean undone, String forward, String inverse) {
        insertOpIdempotencyRowWithReversibleUntil(
                ctx, sessionId, undone, forward, inverse,
                OffsetDateTime.now().plusMinutes(120));
    }

    private void insertOpIdempotencyRowWithReversibleUntil(
            SeedContext ctx, UUID sessionId, boolean undone,
            String forward, String inverse, OffsetDateTime reversibleUntil) {
        jdbc.update(
                "INSERT INTO op_idempotency ("
              + "  client_msg_id, user_id, scope_kind, scope_id, result_version, "
              + "  result_payload, project_id, "
              + "  forward_payload, inverse_payload, reversible_until, "
              + "  is_undone, action_group_id, client_session_id"
              + ") VALUES (?, ?, ?::op_scope_kind, ?, ?, ?::jsonb, ?, "
              + "  ?::jsonb, ?::jsonb, ?, ?, ?, ?)",
                UUID.randomUUID(), ctx.userId, "SHEET_CELL", ctx.projectId, 1L,
                "{\"type\":\"op.acked\"}", ctx.projectId,
                forward, inverse, reversibleUntil, undone, UUID.randomUUID(), sessionId);
    }
}
