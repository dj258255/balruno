// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.workspace;

import java.time.Duration;
import java.util.List;
import java.util.UUID;

/**
 * Outbound API of the workspace module. Other modules (controllers,
 * future project / sheet) call through here — the JPA layer stays
 * encapsulated.
 *
 * Authorisation: every method that accepts a {@code callerUserId}
 * checks the caller's role on the workspace and throws
 * {@link WorkspaceException} (NOT_A_MEMBER / INSUFFICIENT_ROLE /
 * OWNER_REQUIRED) when the caller is not allowed.
 */
public interface WorkspaceService {

    // ── lifecycle ──────────────────────────────────────────────────────

    /** Creates a workspace and registers the caller as OWNER. */
    Workspace create(UUID creatorUserId, String slug, String name);

    /**
     * Auto-creates a default workspace for a brand-new user. Picks an
     * available slug starting from {@code preferredSlugBase}, falling
     * back to numeric suffixes on collision.
     */
    Workspace createDefaultFor(UUID userId, String preferredSlugBase, String name);

    /** Renames and/or re-slugs a workspace. Caller must be Admin or Owner. */
    Workspace update(UUID workspaceId, UUID callerUserId, String newSlug, String newName);

    /** Soft-deletes a workspace. Caller must be the Owner. */
    void softDelete(UUID workspaceId, UUID callerUserId);

    // ── reads ──────────────────────────────────────────────────────────

    Workspace findById(UUID workspaceId);

    /** Looks up an active (non-soft-deleted) workspace by slug. */
    Workspace findBySlug(String slug);

    /** Workspaces the user is a member of (any role). */
    List<Workspace> listForUser(UUID userId);

    /** Members of a workspace. Caller must already be a member (any role). */
    List<WorkspaceMember> listMembers(UUID workspaceId, UUID callerUserId);

    // ── member management ─────────────────────────────────────────────

    /**
     * Removes a member from the workspace. Caller must be Admin or Owner.
     * Removing the last Owner fails with CANNOT_REMOVE_OWNER.
     */
    void removeMember(UUID workspaceId, UUID callerUserId, UUID targetUserId);

    /**
     * Changes a member's role. Caller must be Admin or Owner. Demoting
     * the last Owner fails with CANNOT_REMOVE_OWNER.
     */
    WorkspaceMember changeMemberRole(UUID workspaceId, UUID callerUserId,
                                     UUID targetUserId, WorkspaceRole newRole);

    // ── invites ────────────────────────────────────────────────────────

    /**
     * Creates a share-link invite. Caller must be Admin or Owner. Returns
     * the invite metadata plus the raw opaque token — the raw token is
     * only available right here, never returned again.
     */
    CreatedInvite createInvite(UUID workspaceId, UUID callerUserId,
                               WorkspaceRole role, Duration expiresIn);

    /** Active (unaccepted, unrevoked) invites of the workspace. Admin or Owner. */
    List<WorkspaceInvite> listInvites(UUID workspaceId, UUID callerUserId);

    /** Revokes a pending invite. Caller must be Admin or Owner. */
    void revokeInvite(UUID workspaceId, UUID callerUserId, UUID inviteId);

    /**
     * Accepts an invite by raw token. Any authenticated user may accept;
     * on success a workspace_member row is created and the invite is
     * marked accepted. Returns the resulting (workspace, role) so the
     * client can navigate straight in.
     */
    WorkspaceMember acceptInvite(UUID userId, String rawToken);

    // ── helpers exposed for controllers ───────────────────────────────

    /**
     * Asserts the caller's role is at least {@code minRequired}. Throws
     * {@link WorkspaceException} with reason NOT_A_MEMBER or
     * INSUFFICIENT_ROLE on failure.
     */
    void requireRole(UUID workspaceId, UUID userId, WorkspaceRole minRequired);
}
