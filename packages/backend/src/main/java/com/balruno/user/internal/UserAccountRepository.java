// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.user.internal;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Persistence layer for the GDPR account endpoints — Article 20
 * data export ({@code GET /me/export-data}) + Article 17 hard
 * delete ({@code DELETE /me/account}).
 *
 * Pulled out of {@link AccountController} so the controller stays a
 * thin route + auth surface. The cross-table reads (workspaces +
 * projects + comments + notification prefs) are pure SQL — JPA
 * adds no value here, and the queries map cleanly to the export
 * JSON shape without entity round-tripping.
 *
 * Kept package-private. The wider codebase uses {@link UserAuthService}
 * for read access; this repo only services the GDPR controller.
 */
@Repository
class UserAccountRepository {

    private final JdbcTemplate jdbc;

    UserAccountRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    // ─── Export (Article 20) ─────────────────────────────────────────

    List<Map<String, Object>> userRow(UUID userId) {
        return jdbc.queryForList(
                "SELECT id, email, name, avatar_url, locale, created_at "
              + "FROM users WHERE id = ? AND deleted_at IS NULL",
                userId);
    }

    List<Map<String, Object>> memberships(UUID userId) {
        return jdbc.queryForList(
                "SELECT workspace_id, role, created_at FROM workspace_members WHERE user_id = ?",
                userId);
    }

    List<Map<String, Object>> workspacesForUser(UUID userId) {
        return jdbc.queryForList(
                "SELECT w.id, w.slug, w.name, w.created_at "
              + "FROM workspaces w JOIN workspace_members m ON m.workspace_id = w.id "
              + "WHERE m.user_id = ? AND w.deleted_at IS NULL",
                userId);
    }

    List<Map<String, Object>> projectsForUser(UUID userId) {
        return jdbc.queryForList(
                """
                SELECT p.id, p.workspace_id, p.slug, p.name, p.description,
                       p.data, p.sheet_tree, p.doc_tree,
                       p.data_version, p.sheet_tree_version, p.doc_tree_version,
                       p.created_at, p.updated_at
                FROM projects p
                JOIN workspace_members m ON m.workspace_id = p.workspace_id
                WHERE m.user_id = ? AND p.deleted_at IS NULL
                """,
                userId);
    }

    List<Map<String, Object>> commentsByAuthor(UUID userId) {
        return jdbc.queryForList(
                "SELECT id, project_id, scope_kind, body_json, created_at, updated_at "
              + "FROM comments WHERE author_user_id = ? AND deleted_at IS NULL",
                userId);
    }

    List<Map<String, Object>> notificationPreferences(UUID userId) {
        return jdbc.queryForList(
                "SELECT * FROM user_notification_preferences WHERE user_id = ?",
                userId);
    }

    List<Map<String, Object>> webPushSubscriptions(UUID userId) {
        return jdbc.queryForList(
                "SELECT id, endpoint, user_agent, created_at, last_used_at "
              + "FROM web_push_subscriptions WHERE user_id = ?",
                userId);
    }

    // ─── Delete (Article 17) ─────────────────────────────────────────

    /**
     * Workspaces where the caller is the only Owner AND other members
     * remain — the GDPR delete refuses these so the user must
     * transfer ownership first. Solo-owner / no-other-members
     * workspaces aren't blockers (they cascade-soft-delete with the user).
     */
    List<Map<String, Object>> ownershipBlockers(UUID userId) {
        return jdbc.queryForList(
                """
                SELECT w.id, w.slug
                FROM workspaces w
                WHERE w.deleted_at IS NULL
                  AND EXISTS (
                      SELECT 1 FROM workspace_members
                      WHERE workspace_id = w.id AND user_id = ? AND role = 'OWNER')
                  AND (
                      SELECT COUNT(*) FROM workspace_members
                      WHERE workspace_id = w.id AND role = 'OWNER'
                            AND user_id <> ?) = 0
                  AND (
                      SELECT COUNT(*) FROM workspace_members
                      WHERE workspace_id = w.id AND user_id <> ?) > 0
                """,
                userId, userId, userId);
    }

    /** Snapshot projects about to soft-delete so the storage cascade
     *  knows their (id, workspaceId) pairs. */
    List<Map<String, Object>> projectsToCascade() {
        return jdbc.queryForList(
                """
                SELECT id, workspace_id FROM projects
                WHERE deleted_at IS NULL
                  AND workspace_id IN (
                      SELECT id FROM workspaces WHERE deleted_at IS NOT NULL)
                """);
    }

    @Transactional
    void softDeleteUserAndOwnedWorkspaces(UUID userId) {
        jdbc.update("UPDATE users SET deleted_at = now(), email = NULL WHERE id = ?", userId);
        jdbc.update(
                """
                UPDATE workspaces SET deleted_at = now()
                WHERE deleted_at IS NULL
                  AND id IN (
                      SELECT workspace_id FROM workspace_members
                      WHERE user_id = ? AND role = 'OWNER')
                """,
                userId);
        jdbc.update(
                """
                UPDATE projects SET deleted_at = now()
                WHERE deleted_at IS NULL
                  AND workspace_id IN (
                      SELECT id FROM workspaces WHERE deleted_at IS NOT NULL)
                """);
    }
}
