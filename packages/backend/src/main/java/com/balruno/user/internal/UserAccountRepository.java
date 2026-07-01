// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.user.internal;

import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Persistence for the GDPR account endpoints — Article 20 export
 * ({@code GET /me/export-data}) + Article 17 hard delete
 * ({@code DELETE /me/account}).
 *
 * Each export query returns an interface projection — Spring Data
 * builds the proxy automatically and Jackson serialises the getter
 * shape into the export JSON without an intermediate Map. The Repository
 * extends {@code Repository<UserAccountEntity, UUID>} (the marker, not
 * the full JpaRepository) so derived methods (save / findAll) aren't
 * exposed to the GDPR controller — every method here is a typed
 * native @Query.
 */
public interface UserAccountRepository
        extends Repository<UserAccountRepository.UserAccountEntity, UUID> {

    // ─── Export (Article 20) ─────────────────────────────────────────

    @Query(value = """
                   SELECT id         AS id,
                          email      AS email,
                          name       AS name,
                          avatar_url AS avatarUrl,
                          locale     AS locale,
                          created_at AS createdAt
                     FROM users
                    WHERE id = :userId AND deleted_at IS NULL
                   """,
           nativeQuery = true)
    Optional<UserExportRow> userRow(@Param("userId") UUID userId);

    public interface UserExportRow {
        UUID getId();
        String getEmail();
        String getName();
        String getAvatarUrl();
        String getLocale();
        OffsetDateTime getCreatedAt();
    }

    @Query(value = """
                   SELECT workspace_id AS workspaceId,
                          role         AS role,
                          created_at   AS createdAt
                     FROM workspace_members
                    WHERE user_id = :userId
                   """,
           nativeQuery = true)
    List<MembershipExportRow> memberships(@Param("userId") UUID userId);

    public interface MembershipExportRow {
        UUID getWorkspaceId();
        String getRole();
        OffsetDateTime getCreatedAt();
    }

    @Query(value = """
                   SELECT w.id         AS id,
                          w.slug       AS slug,
                          w.name       AS name,
                          w.created_at AS createdAt
                     FROM workspaces w
                     JOIN workspace_members m ON m.workspace_id = w.id
                    WHERE m.user_id = :userId
                      AND w.deleted_at IS NULL
                   """,
           nativeQuery = true)
    List<WorkspaceExportRow> workspacesForUser(@Param("userId") UUID userId);

    public interface WorkspaceExportRow {
        UUID getId();
        String getSlug();
        String getName();
        OffsetDateTime getCreatedAt();
    }

    @Query(value = """
                   SELECT p.id                  AS id,
                          p.workspace_id        AS workspaceId,
                          p.slug                AS slug,
                          p.name                AS name,
                          p.description         AS description,
                          p.data::text          AS data,
                          p.sheet_tree::text    AS sheetTree,
                          p.data_version        AS dataVersion,
                          p.sheet_tree_version  AS sheetTreeVersion,
                          p.created_at          AS createdAt,
                          p.updated_at          AS updatedAt
                     FROM projects p
                     JOIN workspace_members m ON m.workspace_id = p.workspace_id
                    WHERE m.user_id = :userId AND p.deleted_at IS NULL
                   """,
           nativeQuery = true)
    List<ProjectExportRow> projectsForUser(@Param("userId") UUID userId);

    public interface ProjectExportRow {
        UUID getId();
        UUID getWorkspaceId();
        String getSlug();
        String getName();
        String getDescription();
        String getData();
        String getSheetTree();
        long getDataVersion();
        long getSheetTreeVersion();
        OffsetDateTime getCreatedAt();
        OffsetDateTime getUpdatedAt();
    }

    @Query(value = """
                   SELECT id              AS id,
                          project_id      AS projectId,
                          scope_kind::text AS scopeKind,
                          body_json::text AS bodyJson,
                          created_at      AS createdAt,
                          updated_at      AS updatedAt
                     FROM comments
                    WHERE author_user_id = :userId AND deleted_at IS NULL
                   """,
           nativeQuery = true)
    List<CommentExportRow> commentsByAuthor(@Param("userId") UUID userId);

    public interface CommentExportRow {
        UUID getId();
        UUID getProjectId();
        String getScopeKind();
        String getBodyJson();
        OffsetDateTime getCreatedAt();
        OffsetDateTime getUpdatedAt();
    }

    @Query(value = """
                   SELECT user_id                AS userId,
                          email_on_mention       AS emailOnMention,
                          email_on_comment_reply AS emailOnCommentReply,
                          push_on_mention        AS pushOnMention,
                          push_on_comment_reply  AS pushOnCommentReply,
                          digest_frequency       AS digestFrequency,
                          updated_at             AS updatedAt
                     FROM user_notification_preferences
                    WHERE user_id = :userId
                   """,
           nativeQuery = true)
    Optional<NotificationPrefsExportRow> notificationPreferences(@Param("userId") UUID userId);

    public interface NotificationPrefsExportRow {
        UUID getUserId();
        boolean getEmailOnMention();
        boolean getEmailOnCommentReply();
        boolean getPushOnMention();
        boolean getPushOnCommentReply();
        String getDigestFrequency();
        OffsetDateTime getUpdatedAt();
    }

    @Query(value = """
                   SELECT id           AS id,
                          endpoint     AS endpoint,
                          user_agent   AS userAgent,
                          created_at   AS createdAt,
                          last_used_at AS lastUsedAt
                     FROM web_push_subscriptions
                    WHERE user_id = :userId
                   """,
           nativeQuery = true)
    List<WebPushExportRow> webPushSubscriptions(@Param("userId") UUID userId);

    public interface WebPushExportRow {
        UUID getId();
        String getEndpoint();
        String getUserAgent();
        OffsetDateTime getCreatedAt();
        OffsetDateTime getLastUsedAt();
    }

    // ─── Delete (Article 17) ─────────────────────────────────────────

    /**
     * Workspaces where the caller is the only Owner AND other members
     * remain — the GDPR delete refuses these so the user must
     * transfer ownership first. Solo-owner / no-other-members
     * workspaces aren't blockers (they cascade-soft-delete with the user).
     */
    @Query(value = """
                   SELECT w.id   AS id,
                          w.slug AS slug
                     FROM workspaces w
                    WHERE w.deleted_at IS NULL
                      AND EXISTS (
                          SELECT 1 FROM workspace_members
                           WHERE workspace_id = w.id
                             AND user_id = :userId
                             AND role = 'OWNER')
                      AND (
                          SELECT COUNT(*) FROM workspace_members
                           WHERE workspace_id = w.id
                             AND role = 'OWNER'
                             AND user_id <> :userId) = 0
                      AND (
                          SELECT COUNT(*) FROM workspace_members
                           WHERE workspace_id = w.id
                             AND user_id <> :userId) > 0
                   """,
           nativeQuery = true)
    List<OwnershipBlockerRow> ownershipBlockers(@Param("userId") UUID userId);

    public interface OwnershipBlockerRow {
        UUID getId();
        String getSlug();
    }

    /** Snapshot projects about to soft-delete so the storage cascade
     *  knows their (id, workspaceId) pairs. */
    @Query(value = """
                   SELECT id           AS id,
                          workspace_id AS workspaceId
                     FROM projects
                    WHERE deleted_at IS NULL
                      AND workspace_id IN (
                          SELECT id FROM workspaces WHERE deleted_at IS NOT NULL)
                   """,
           nativeQuery = true)
    List<ProjectCascadeRow> projectsToCascade();

    public interface ProjectCascadeRow {
        UUID getId();
        UUID getWorkspaceId();
    }

    // The three soft-deletes below run inside a single @Transactional
    // call from the controller. The order matters: users first (so the
    // membership filter has a stable target), then workspaces by
    // ownership, then projects under the now-soft-deleted workspaces.

    @Modifying
    @Query(value = "UPDATE users SET deleted_at = now(), email = NULL WHERE id = :userId",
           nativeQuery = true)
    int softDeleteUser(@Param("userId") UUID userId);

    @Modifying
    @Query(value = """
                   UPDATE workspaces SET deleted_at = now()
                    WHERE deleted_at IS NULL
                      AND id IN (
                          SELECT workspace_id FROM workspace_members
                           WHERE user_id = :userId AND role = 'OWNER')
                   """,
           nativeQuery = true)
    int softDeleteOwnedWorkspaces(@Param("userId") UUID userId);

    @Modifying
    @Query(value = """
                   UPDATE projects SET deleted_at = now()
                    WHERE deleted_at IS NULL
                      AND workspace_id IN (
                          SELECT id FROM workspaces WHERE deleted_at IS NOT NULL)
                   """,
           nativeQuery = true)
    int softDeleteProjectsOfDeletedWorkspaces();

    /**
     * Type-binding stub — Spring Data needs a managed entity for the
     * repository's domain type parameter. Reuses the {@code users}
     * table (already mapped fully in {@code UserEntity}) but only the
     * primary key, since none of the methods above load it.
     */
    @jakarta.persistence.Entity
    @jakarta.persistence.Table(name = "users")
    class UserAccountEntity {
        @jakarta.persistence.Id
        @jakarta.persistence.Column(name = "id", nullable = false, updatable = false, insertable = false)
        private UUID id;

        protected UserAccountEntity() {}
    }
}
