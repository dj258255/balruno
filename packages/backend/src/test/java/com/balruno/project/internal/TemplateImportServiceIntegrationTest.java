// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.project.internal;

import com.balruno.TestcontainersConfig;
import com.balruno.project.Project;
import com.balruno.project.ProjectService;
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
 * Integration test for ADR 0020 Stage F template import — verifies
 * that calling {@link TemplateImportService#apply} on a real
 * PostgreSQL container (Testcontainers) actually grafts the catalog
 * group's sheets onto {@code projects.data} and adds a folder to
 * {@code projects.sheet_tree}, atomically bumping both versions.
 *
 * Auth is mocked at {@link ProjectService#findById} so the test can
 * skip the workspace-member chain — that surface has its own unit
 * tests in {@link ProjectServiceImplTest}.
 *
 * Runs only when Docker daemon is reachable. CI inherits the same
 * Testcontainers harness as {@link com.balruno.BalrunoBackendApplicationTests}.
 * Local runs without Docker skip via the Testcontainers strategy
 * fallback (the test class itself doesn't gate, the container init
 * does).
 */
@ExtendWith(SpringExtension.class)
@SpringBootTest
@Import(TestcontainersConfig.class)
class TemplateImportServiceIntegrationTest {

    @Autowired TemplateImportService templates;
    @Autowired JdbcTemplate jdbc;
    @MockitoBean ProjectService projects;

    @Test
    @Transactional
    void rpgGroupGraftsSheetsAndFolderOntoExistingProject() throws Exception {
        // Set up a minimal project row directly via JDBC — bypasses
        // the workspace + user creation chain. The seed shape mirrors
        // V10's default-project insert: empty Sheet 1 with one column
        // and one row, both data + sheet_tree at version 0.
        var projectId = UUID.randomUUID();
        var workspaceId = UUID.randomUUID();
        var userId = UUID.randomUUID();
        seedProject(projectId, workspaceId);

        // Mock the auth check so the test doesn't need a real user /
        // membership row. The service's apply() ignores the return
        // value beyond the throws-on-missing contract.
        when(projects.findById(any(), any())).thenReturn(
            Mockito.mock(Project.class));

        templates.apply(projectId, userId, "rpg", "ko");

        // Assert: projects.data carries the RPG group's sheets
        // (Characters / Weapons / EXP Curve / Gacha Rates in Korean).
        var dataJson = jdbc.queryForObject(
                "SELECT data::text FROM projects WHERE id = ?",
                String.class, projectId);
        assertThat(dataJson).isNotNull();
        assertThat(dataJson).contains("캐릭터");
        assertThat(dataJson).contains("무기");

        // Assert: projects.sheet_tree gained a folder named "RPG 프로젝트"
        // with the matching sheet leaves.
        var treeJson = jdbc.queryForObject(
                "SELECT sheet_tree::text FROM projects WHERE id = ?",
                String.class, projectId);
        assertThat(treeJson).isNotNull();
        assertThat(treeJson).contains("RPG 프로젝트");

        // Assert: both versions advanced. V8 ships *_version columns
        // with NOT NULL DEFAULT 1, so a freshly-seeded project starts
        // at 1:1 and advances to 2:2 after one templates.apply call.
        var versions = jdbc.queryForObject(
                "SELECT data_version, sheet_tree_version FROM projects WHERE id = ?",
                (rs, i) -> rs.getLong(1) + ":" + rs.getLong(2),
                projectId);
        assertThat(versions).isEqualTo("2:2");
    }

    @Test
    @Transactional
    void unknownGroupIdRejected() {
        var projectId = UUID.randomUUID();
        seedProject(projectId, UUID.randomUUID());
        when(projects.findById(any(), any())).thenReturn(
            Mockito.mock(Project.class));

        assertThatThrownBy(() ->
            templates.apply(projectId, UUID.randomUUID(), "no-such-group", "ko")
        )
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("starter pack group not found");
    }

    /** Insert minimal users + workspaces + projects rows matching the
     *  schemas in V1 / V2 / V4 / V5 / V8 migrations. The auth path
     *  through ProjectService.findById is @MockitoBean'd, so role +
     *  membership rows aren't needed — the FK chain just has to be
     *  satisfiable. */
    private void seedProject(UUID projectId, UUID workspaceId) {
        // 1. user row — workspaces.created_by + projects.created_by
        //    are NOT NULL FKs to users(id).
        var userId = UUID.randomUUID();
        jdbc.update(
                "INSERT INTO users (id, email) VALUES (?, ?)",
                userId,
                "test-" + userId.toString().substring(0, 8) + "@example.com");

        // 2. workspaces — schema in V2 (created_by NOT NULL) + V5
        //    (plan NOT NULL DEFAULT 'FREE'). Plan defaults so we can
        //    omit it from the INSERT.
        jdbc.update(
                "INSERT INTO workspaces (id, slug, name, created_by) "
              + "VALUES (?, ?, ?, ?)",
                workspaceId,
                "test-" + workspaceId.toString().substring(0, 8),
                "test workspace",
                userId);

        // 3. projects — base columns from V4 + JSONB sync columns from
        //    V8. Versions default to 0; data/sheet_tree/doc_tree
        //    default to '[]'::jsonb on the schema side.
        jdbc.update(
                "INSERT INTO projects ("
              + "  id, workspace_id, slug, name, description, created_by, "
              + "  data, sheet_tree, doc_tree"
              + ") VALUES (?, ?, ?, ?, ?, ?, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb)",
                projectId,
                workspaceId,
                "test-project",
                "Test Project",
                null,
                userId);
    }

}
