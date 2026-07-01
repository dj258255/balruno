// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.comment.internal;

import com.balruno.TestcontainersConfig;
import com.balruno.comment.Comment;
import com.balruno.comment.CommentService;
import com.balruno.project.Project;
import com.balruno.project.ProjectService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
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

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

/**
 * Integration test for ADR 0024 comments — round-trips create /
 * read / update / resolve / delete against the real Postgres
 * (Testcontainers).
 *
 * Auth is mocked at {@link ProjectService#findById}; the membership
 * + workspace chain is exercised by separate unit tests.
 */
@ExtendWith(SpringExtension.class)
@SpringBootTest
@Import(TestcontainersConfig.class)
class CommentServiceIntegrationTest {

    @Autowired CommentService comments;
    @Autowired JdbcTemplate jdbc;
    @MockitoBean ProjectService projects;

    private static final ObjectMapper M = new ObjectMapper();

    @Test
    @Transactional
    void cellCommentRoundTrips() throws Exception {
        var ctx = seed();
        when(projects.findById(any(), any())).thenReturn(Mockito.mock(Project.class));

        var sheetId = UUID.randomUUID();
        var rowId = UUID.randomUUID();
        var columnId = UUID.randomUUID();
        var body = bodyOf("test cell comment");

        var created = comments.create(ctx.userId, new CommentService.CreateRequest(
                ctx.projectId, Comment.ScopeKind.SHEET_CELL,
                sheetId, rowId, columnId,
                null, body));

        assertThat(created.id()).isNotNull();
        assertThat(created.scopeKind()).isEqualTo(Comment.ScopeKind.SHEET_CELL);
        assertThat(created.sheetId()).isEqualTo(sheetId);
        assertThat(created.resolved()).isFalse();
        assertThat(created.bodyJson()).isNotNull();

        var listed = comments.listForCell(ctx.userId, ctx.projectId, sheetId, rowId, columnId);
        assertThat(listed).hasSize(1);
        assertThat(listed.get(0).id()).isEqualTo(created.id());

        var updated = comments.setResolved(ctx.userId, created.id(), true);
        assertThat(updated.resolved()).isTrue();
        assertThat(updated.resolvedBy()).isEqualTo(ctx.userId);

        comments.remove(ctx.userId, created.id());
        var afterDelete = comments.listForCell(ctx.userId, ctx.projectId, sheetId, rowId, columnId);
        assertThat(afterDelete).isEmpty();
    }

    @Test
    @Transactional
    void onlyAuthorCanDelete() throws Exception {
        var ctx = seed();
        when(projects.findById(any(), any())).thenReturn(Mockito.mock(Project.class));

        var sheetId = UUID.randomUUID();
        var rowId = UUID.randomUUID();
        var columnId = UUID.randomUUID();
        var created = comments.create(ctx.userId, new CommentService.CreateRequest(
                ctx.projectId, Comment.ScopeKind.SHEET_CELL,
                sheetId, rowId, columnId,
                null, bodyOf("hi")));

        var otherUser = UUID.randomUUID();
        jdbc.update(
                "INSERT INTO users (id, email) VALUES (?, ?)",
                otherUser,
                "other-" + otherUser.toString().substring(0, 8) + "@example.com");

        assertThatThrownBy(() -> comments.remove(otherUser, created.id()))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("only the author");
    }

    private record SeedContext(UUID projectId, UUID userId, UUID workspaceId) {}

    private SeedContext seed() {
        var userId = UUID.randomUUID();
        var workspaceId = UUID.randomUUID();
        var projectId = UUID.randomUUID();
        jdbc.update(
                "INSERT INTO users (id, email) VALUES (?, ?)",
                userId,
                "comment-test-" + userId.toString().substring(0, 8) + "@example.com");
        jdbc.update(
                "INSERT INTO workspaces (id, slug, name, created_by) "
              + "VALUES (?, ?, ?, ?)",
                workspaceId,
                "ct-" + workspaceId.toString().substring(0, 8),
                "comment test ws",
                userId);
        jdbc.update(
                "INSERT INTO projects ("
              + "  id, workspace_id, slug, name, description, created_by, "
              + "  data, sheet_tree"
              + ") VALUES (?, ?, ?, ?, ?, ?, '[]'::jsonb, '[]'::jsonb)",
                projectId, workspaceId, "ct-proj", "Comment Test Project", null, userId);
        return new SeedContext(projectId, userId, workspaceId);
    }

    private static JsonNode bodyOf(String text) {
        try {
            return M.readTree(
                    "{\"type\":\"doc\",\"content\":[{\"type\":\"paragraph\","
                  + "\"content\":[{\"type\":\"text\",\"text\":\""
                  + text.replace("\"", "\\\"") + "\"}]}]}");
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }
}
