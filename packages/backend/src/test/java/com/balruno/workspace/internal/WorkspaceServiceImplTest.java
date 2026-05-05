// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.workspace.internal;

import com.balruno.workspace.WorkspaceException;
import com.balruno.workspace.WorkspaceRole;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.lang.reflect.Field;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * WorkspaceServiceImpl unit tests organised across four scenario classes:
 *   - Happy: the expected normal flow
 *   - Boundary: exact thresholds (last-Owner, slug length, TTL caps)
 *   - Edge: unusual but valid inputs
 *   - Corner: combinations of edge cases interacting
 *
 * Repositories are mocked. The pure logic under test is the role check
 * pipeline + invite token rules + last-Owner protection — no DB
 * dependence at this layer.
 */
@ExtendWith(MockitoExtension.class)
class WorkspaceServiceImplTest {

    @Mock WorkspaceRepository workspaces;
    @Mock WorkspaceMemberRepository members;
    @Mock WorkspaceInviteRepository invites;
    @InjectMocks WorkspaceServiceImpl service;

    // Common fixtures.
    private final UUID wsId = UUID.randomUUID();
    private final UUID ownerId = UUID.randomUUID();
    private final UUID adminId = UUID.randomUUID();
    private final UUID editorId = UUID.randomUUID();
    private final UUID viewerId = UUID.randomUUID();
    private final UUID outsiderId = UUID.randomUUID();

    // ── Happy path ─────────────────────────────────────────────────────

    @Nested
    @DisplayName("Happy")
    class Happy {

        @Test
        void create_inserts_workspace_then_owner_member() {
            when(workspaces.existsBySlugAndDeletedAtIsNull("studio-x")).thenReturn(false);
            when(workspaces.saveAndFlush(any(WorkspaceEntity.class)))
                    .thenAnswer(inv -> stampWorkspace(inv.getArgument(0), wsId));

            var dto = service.create(ownerId, "studio-x", "Studio X");

            assertThat(dto.id()).isEqualTo(wsId);
            assertThat(dto.slug()).isEqualTo("studio-x");
            assertThat(dto.name()).isEqualTo("Studio X");
            verify(members).save(any(WorkspaceMemberEntity.class));
        }

        @Test
        void requireRole_passes_when_caller_meets_minimum() {
            mockMember(ownerId, WorkspaceRole.OWNER);
            service.requireRole(wsId, ownerId, WorkspaceRole.EDITOR);
        }

        @Test
        void createInvite_admin_inviting_editor_returns_raw_token() {
            mockMember(adminId, WorkspaceRole.ADMIN);
            when(workspaces.findById(wsId)).thenReturn(Optional.of(activeWorkspace()));
            when(invites.saveAndFlush(any(WorkspaceInviteEntity.class)))
                    .thenAnswer(inv -> stampInvite(inv.getArgument(0)));

            var created = service.createInvite(wsId, adminId, WorkspaceRole.EDITOR, Duration.ofDays(3));

            assertThat(created.rawToken()).isNotBlank();
            assertThat(created.rawToken().length()).isBetween(40, 50); // base64url(32 bytes) ≈ 43
            assertThat(created.invite().role()).isEqualTo(WorkspaceRole.EDITOR);
            assertThat(created.invite().expiresAt()).isAfter(OffsetDateTime.now(ZoneOffset.UTC));
        }
    }

    // ── Boundary ───────────────────────────────────────────────────────

    @Nested
    @DisplayName("Boundary")
    class Boundary {

        @Test
        void create_with_min_length_slug_is_accepted() {
            when(workspaces.existsBySlugAndDeletedAtIsNull("abc")).thenReturn(false);
            when(workspaces.saveAndFlush(any(WorkspaceEntity.class)))
                    .thenAnswer(inv -> stampWorkspace(inv.getArgument(0), wsId));

            var dto = service.create(ownerId, "abc", "Three");

            assertThat(dto.slug()).isEqualTo("abc");
        }

        @Test
        void create_with_max_length_slug_is_accepted() {
            var slug = "a23456789012345678901234567890"; // 30 chars
            when(workspaces.existsBySlugAndDeletedAtIsNull(slug)).thenReturn(false);
            when(workspaces.saveAndFlush(any(WorkspaceEntity.class)))
                    .thenAnswer(inv -> stampWorkspace(inv.getArgument(0), wsId));

            var dto = service.create(ownerId, slug, "Max");

            assertThat(dto.slug()).hasSize(30);
        }

        @Test
        void removeMember_blocks_demoting_or_removing_the_only_owner() {
            mockMember(ownerId, WorkspaceRole.OWNER);
            // The caller (also the target) is the only Owner.
            when(members.findByWorkspaceIdAndUserId(wsId, ownerId))
                    .thenReturn(Optional.of(member(wsId, ownerId, WorkspaceRole.OWNER)));
            when(members.countByWorkspaceIdAndRole(wsId, WorkspaceRole.OWNER)).thenReturn(1L);

            assertThatThrownBy(() -> service.removeMember(wsId, ownerId, ownerId))
                    .isInstanceOfSatisfying(WorkspaceException.class, e ->
                            assertThat(e.reason()).isEqualTo(WorkspaceException.Reason.CANNOT_REMOVE_OWNER));
        }

        @Test
        void createInvite_caps_ttl_at_thirty_days() {
            mockMember(adminId, WorkspaceRole.ADMIN);
            when(workspaces.findById(wsId)).thenReturn(Optional.of(activeWorkspace()));
            when(invites.saveAndFlush(any(WorkspaceInviteEntity.class)))
                    .thenAnswer(inv -> stampInvite(inv.getArgument(0)));

            // Ask for 365d, expect cap at 30d.
            var created = service.createInvite(wsId, adminId, WorkspaceRole.EDITOR, Duration.ofDays(365));

            var ttl = Duration.between(OffsetDateTime.now(ZoneOffset.UTC), created.invite().expiresAt());
            assertThat(ttl).isLessThanOrEqualTo(Duration.ofDays(30).plusMinutes(1));
            assertThat(ttl).isGreaterThan(Duration.ofDays(29));
        }

        @Test
        void createInvite_negative_ttl_falls_back_to_default_seven_days() {
            mockMember(adminId, WorkspaceRole.ADMIN);
            when(workspaces.findById(wsId)).thenReturn(Optional.of(activeWorkspace()));
            when(invites.saveAndFlush(any(WorkspaceInviteEntity.class)))
                    .thenAnswer(inv -> stampInvite(inv.getArgument(0)));

            var created = service.createInvite(wsId, adminId, WorkspaceRole.EDITOR, Duration.ofDays(-1));

            var ttl = Duration.between(OffsetDateTime.now(ZoneOffset.UTC), created.invite().expiresAt());
            assertThat(ttl).isBetween(Duration.ofDays(6).plusHours(23), Duration.ofDays(7).plusMinutes(1));
        }
    }

    // ── Edge ───────────────────────────────────────────────────────────

    @Nested
    @DisplayName("Edge")
    class Edge {

        @Test
        void requireRole_rejects_outsider_with_NOT_A_MEMBER() {
            when(members.findByWorkspaceIdAndUserId(wsId, outsiderId)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.requireRole(wsId, outsiderId, WorkspaceRole.VIEWER))
                    .isInstanceOfSatisfying(WorkspaceException.class, e ->
                            assertThat(e.reason()).isEqualTo(WorkspaceException.Reason.NOT_A_MEMBER));
        }

        @Test
        void requireRole_rejects_caller_below_minimum_with_INSUFFICIENT_ROLE() {
            mockMember(viewerId, WorkspaceRole.VIEWER);

            assertThatThrownBy(() -> service.requireRole(wsId, viewerId, WorkspaceRole.EDITOR))
                    .isInstanceOfSatisfying(WorkspaceException.class, e ->
                            assertThat(e.reason()).isEqualTo(WorkspaceException.Reason.INSUFFICIENT_ROLE));
        }

        @Test
        void createInvite_with_null_role_defaults_to_VIEWER() {
            mockMember(adminId, WorkspaceRole.ADMIN);
            when(workspaces.findById(wsId)).thenReturn(Optional.of(activeWorkspace()));
            when(invites.saveAndFlush(any(WorkspaceInviteEntity.class)))
                    .thenAnswer(inv -> stampInvite(inv.getArgument(0)));

            var created = service.createInvite(wsId, adminId, null, null);

            assertThat(created.invite().role()).isEqualTo(WorkspaceRole.VIEWER);
        }

        @Test
        void acceptInvite_rejects_blank_token() {
            assertThatThrownBy(() -> service.acceptInvite(editorId, ""))
                    .isInstanceOf(WorkspaceException.class);
            assertThatThrownBy(() -> service.acceptInvite(editorId, null))
                    .isInstanceOf(WorkspaceException.class);
        }

        @Test
        void acceptInvite_rejects_unknown_token_with_NOT_FOUND() {
            when(invites.findByTokenHash(any())).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.acceptInvite(editorId, "not-a-real-token"))
                    .isInstanceOfSatisfying(WorkspaceException.class, e ->
                            assertThat(e.reason()).isEqualTo(WorkspaceException.Reason.WORKSPACE_NOT_FOUND));
        }
    }

    // ── Corner ─────────────────────────────────────────────────────────

    @Nested
    @DisplayName("Corner")
    class Corner {

        @Test
        void createInvite_refuses_to_grant_OWNER_role() {
            mockMember(ownerId, WorkspaceRole.OWNER);
            when(workspaces.findById(wsId)).thenReturn(Optional.of(activeWorkspace()));

            assertThatThrownBy(() -> service.createInvite(wsId, ownerId, WorkspaceRole.OWNER, null))
                    .isInstanceOfSatisfying(WorkspaceException.class, e ->
                            assertThat(e.reason()).isEqualTo(WorkspaceException.Reason.OWNER_REQUIRED));
        }

        @Test
        void removeMember_with_two_owners_succeeds_for_either_one() {
            mockMember(ownerId, WorkspaceRole.OWNER);
            var otherOwner = UUID.randomUUID();
            when(members.findByWorkspaceIdAndUserId(wsId, otherOwner))
                    .thenReturn(Optional.of(member(wsId, otherOwner, WorkspaceRole.OWNER)));
            when(members.countByWorkspaceIdAndRole(wsId, WorkspaceRole.OWNER)).thenReturn(2L);

            service.removeMember(wsId, ownerId, otherOwner);

            verify(members).delete(any(WorkspaceMemberEntity.class));
        }

        @Test
        void changeMemberRole_blocks_demoting_the_last_owner() {
            mockMember(ownerId, WorkspaceRole.OWNER);
            when(members.findByWorkspaceIdAndUserId(wsId, ownerId))
                    .thenReturn(Optional.of(member(wsId, ownerId, WorkspaceRole.OWNER)));
            when(members.countByWorkspaceIdAndRole(wsId, WorkspaceRole.OWNER)).thenReturn(1L);

            assertThatThrownBy(() ->
                    service.changeMemberRole(wsId, ownerId, ownerId, WorkspaceRole.ADMIN))
                    .isInstanceOfSatisfying(WorkspaceException.class, e ->
                            assertThat(e.reason()).isEqualTo(WorkspaceException.Reason.CANNOT_REMOVE_OWNER));
        }

        @Test
        void softDelete_requires_OWNER_even_for_ADMIN() {
            when(members.findByWorkspaceIdAndUserId(wsId, adminId))
                    .thenReturn(Optional.of(member(wsId, adminId, WorkspaceRole.ADMIN)));

            assertThatThrownBy(() -> service.softDelete(wsId, adminId))
                    .isInstanceOfSatisfying(WorkspaceException.class, e ->
                            assertThat(e.reason()).isEqualTo(WorkspaceException.Reason.OWNER_REQUIRED));
        }

        @Test
        void acceptInvite_when_already_a_member_keeps_existing_role() {
            // Caller is already EDITOR; an ADMIN-role invite is consumed but
            // their role does not get upgraded — explicit role changes go
            // through changeMemberRole.
            var rawToken = "fake-but-consistent-token-string";
            var invite = activeInviteFor(WorkspaceRole.ADMIN, rawToken);
            when(invites.findByTokenHash(any())).thenReturn(Optional.of(invite));
            when(workspaces.findById(wsId)).thenReturn(Optional.of(activeWorkspace()));
            var existing = member(wsId, editorId, WorkspaceRole.EDITOR);
            when(members.findByWorkspaceIdAndUserId(wsId, editorId)).thenReturn(Optional.of(existing));

            var result = service.acceptInvite(editorId, rawToken);

            assertThat(result.role()).isEqualTo(WorkspaceRole.EDITOR); // unchanged
            verify(invites).save(any(WorkspaceInviteEntity.class));    // marked accepted
            verify(members, never()).save(any(WorkspaceMemberEntity.class)); // no new row
        }

        @Test
        void acceptInvite_revoked_throws_INVITE_REVOKED() {
            var invite = activeInviteFor(WorkspaceRole.EDITOR, "x");
            invite.revoke();
            when(invites.findByTokenHash(any())).thenReturn(Optional.of(invite));

            assertThatThrownBy(() -> service.acceptInvite(editorId, "x"))
                    .isInstanceOfSatisfying(WorkspaceException.class, e ->
                            assertThat(e.reason()).isEqualTo(WorkspaceException.Reason.INVITE_REVOKED));
        }

        @Test
        void acceptInvite_already_accepted_throws_INVITE_ALREADY_USED() {
            var invite = activeInviteFor(WorkspaceRole.EDITOR, "x");
            invite.markAccepted(viewerId);
            when(invites.findByTokenHash(any())).thenReturn(Optional.of(invite));

            assertThatThrownBy(() -> service.acceptInvite(editorId, "x"))
                    .isInstanceOfSatisfying(WorkspaceException.class, e ->
                            assertThat(e.reason()).isEqualTo(WorkspaceException.Reason.INVITE_ALREADY_USED));
        }

        @Test
        void acceptInvite_expired_throws_INVITE_EXPIRED() {
            var invite = expiredInviteFor(WorkspaceRole.EDITOR);
            when(invites.findByTokenHash(any())).thenReturn(Optional.of(invite));

            assertThatThrownBy(() -> service.acceptInvite(editorId, "x"))
                    .isInstanceOfSatisfying(WorkspaceException.class, e ->
                            assertThat(e.reason()).isEqualTo(WorkspaceException.Reason.INVITE_EXPIRED));
        }
    }

    // ── helpers ────────────────────────────────────────────────────────

    private void mockMember(UUID userId, WorkspaceRole role) {
        lenient().when(members.findByWorkspaceIdAndUserId(wsId, userId))
                .thenReturn(Optional.of(member(wsId, userId, role)));
    }

    private static WorkspaceMemberEntity member(UUID wsId, UUID userId, WorkspaceRole role) {
        var m = new WorkspaceMemberEntity(wsId, userId, role);
        setField(m, "joinedAt", OffsetDateTime.now(ZoneOffset.UTC));
        return m;
    }

    private WorkspaceEntity activeWorkspace() {
        var w = new WorkspaceEntity("ws-stub", "Stub", ownerId);
        setField(w, "id", wsId);
        var now = OffsetDateTime.now(ZoneOffset.UTC);
        setField(w, "createdAt", now);
        setField(w, "updatedAt", now);
        return w;
    }

    private WorkspaceInviteEntity activeInviteFor(WorkspaceRole role, String rawToken) {
        var hash = SecureToken.hash(rawToken);
        var invite = new WorkspaceInviteEntity(wsId, ownerId, hash, role,
                OffsetDateTime.now(ZoneOffset.UTC).plusDays(7));
        setField(invite, "id", UUID.randomUUID());
        return invite;
    }

    private WorkspaceInviteEntity expiredInviteFor(WorkspaceRole role) {
        var invite = new WorkspaceInviteEntity(wsId, ownerId, SecureToken.hash("x"), role,
                OffsetDateTime.now(ZoneOffset.UTC).minusMinutes(1));
        setField(invite, "id", UUID.randomUUID());
        return invite;
    }

    private static WorkspaceEntity stampWorkspace(WorkspaceEntity entity, UUID id) {
        setField(entity, "id", id);
        var now = OffsetDateTime.now(ZoneOffset.UTC);
        setField(entity, "createdAt", now);
        setField(entity, "updatedAt", now);
        return entity;
    }

    private static WorkspaceInviteEntity stampInvite(WorkspaceInviteEntity entity) {
        setField(entity, "id", UUID.randomUUID());
        return entity;
    }

    private static void setField(Object target, String name, Object value) {
        try {
            Field f = findField(target.getClass(), name);
            f.setAccessible(true);
            f.set(target, value);
        } catch (ReflectiveOperationException e) {
            throw new AssertionError("Failed to set " + name, e);
        }
    }

    private static Field findField(Class<?> clazz, String name) throws NoSuchFieldException {
        for (Class<?> c = clazz; c != null; c = c.getSuperclass()) {
            try { return c.getDeclaredField(name); } catch (NoSuchFieldException ignored) {}
        }
        throw new NoSuchFieldException(name);
    }

    @SuppressWarnings("unused")
    private static List<UUID> ___unused() { return List.of(); }
}
