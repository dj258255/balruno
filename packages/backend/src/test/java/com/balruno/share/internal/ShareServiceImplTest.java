// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.share.internal;

import com.balruno.project.Project;
import com.balruno.project.ProjectService;
import com.balruno.share.ShareLink;
import com.balruno.share.ShareService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * ShareServiceImpl unit tests covering the auth-gating + idempotency
 * + expiry semantics. The public read snapshot path uses raw
 * JdbcTemplate; tests for that path stop at "before snapshot read"
 * boundary (token validity / expiry / revoke) — the actual SQL
 * projection is exercised by integration tests.
 */
@ExtendWith(MockitoExtension.class)
class ShareServiceImplTest {

    @Mock ShareLinkRepository repo;
    @Mock ProjectService projects;
    @Mock JdbcTemplate jdbc;
    @InjectMocks ShareServiceImpl service;

    @Nested
    @DisplayName("create")
    class Create {

        @Test
        void member_creates_link_and_repository_save_returns_dto() {
            var caller = UUID.randomUUID();
            var projectId = UUID.randomUUID();
            stubMember(projectId, caller);
            var saved = stubSavedEntity(projectId);
            when(repo.save(any())).thenReturn(saved);

            var link = service.create(caller, new ShareService.CreateRequest(
                    projectId, null, "table", null));

            assertThat(link.projectId()).isEqualTo(projectId);
            assertThat(link.activeView()).isEqualTo("table");
            verify(projects).findById(eq(projectId), eq(caller));
        }

        @Test
        void non_member_findById_throws_short_circuits_save() {
            var caller = UUID.randomUUID();
            var projectId = UUID.randomUUID();
            when(projects.findById(eq(projectId), eq(caller)))
                    .thenThrow(new RuntimeException("PROJECT_NOT_FOUND"));

            assertThatThrownBy(() -> service.create(caller, new ShareService.CreateRequest(
                    projectId, null, null, null)))
                    .isInstanceOf(RuntimeException.class);
            verify(repo, never()).save(any());
        }

        @Test
        void create_passes_expires_at_through_to_repository() {
            var caller = UUID.randomUUID();
            var projectId = UUID.randomUUID();
            var sheetId = UUID.randomUUID();
            var expiry = OffsetDateTime.now().plusDays(7);
            stubMember(projectId, caller);
            when(repo.save(any())).thenReturn(stubSavedEntity(projectId));

            service.create(caller, new ShareService.CreateRequest(
                    projectId, sheetId, "kanban", expiry));

            var entityCap = ArgumentCaptor.forClass(ShareLinkEntity.class);
            verify(repo).save(entityCap.capture());
            // The captured entity carries the full create-request payload.
            assertThat(entityCap.getValue().toDto().expiresAt()).isEqualTo(expiry);
            assertThat(entityCap.getValue().toDto().sheetId()).isEqualTo(sheetId);
        }
    }

    @Nested
    @DisplayName("listForProject")
    class List_ {

        @Test
        void member_gets_links_in_repo_order() {
            var caller = UUID.randomUUID();
            var projectId = UUID.randomUUID();
            stubMember(projectId, caller);
            when(repo.findByProjectIdOrderByCreatedAtDesc(eq(projectId)))
                    .thenReturn(List.of(stubSavedEntity(projectId)));

            var result = service.listForProject(caller, projectId);

            assertThat(result).hasSize(1);
        }

        @Test
        void non_member_findById_throws_no_repo_call() {
            var caller = UUID.randomUUID();
            var projectId = UUID.randomUUID();
            when(projects.findById(eq(projectId), eq(caller)))
                    .thenThrow(new RuntimeException("PROJECT_NOT_FOUND"));

            assertThatThrownBy(() -> service.listForProject(caller, projectId))
                    .isInstanceOf(RuntimeException.class);
            verify(repo, never()).findByProjectIdOrderByCreatedAtDesc(any());
        }
    }

    @Nested
    @DisplayName("revoke")
    class Revoke {

        @Test
        void member_revokes_existing_link() {
            var caller = UUID.randomUUID();
            var linkId = UUID.randomUUID();
            var projectId = UUID.randomUUID();
            var entity = stubSavedEntity(projectId);
            when(repo.findById(eq(linkId))).thenReturn(Optional.of(entity));
            stubMember(projectId, caller);

            service.revoke(caller, linkId);

            verify(repo).revoke(eq(linkId), any(OffsetDateTime.class));
        }

        @Test
        void unknown_link_id_is_idempotent_no_throw() {
            // Revoking a non-existent id — already deleted/never existed
            // — must succeed silently. Two clients clicking "Revoke"
            // simultaneously shouldn't error on the second call.
            var caller = UUID.randomUUID();
            var linkId = UUID.randomUUID();
            when(repo.findById(eq(linkId))).thenReturn(Optional.empty());

            service.revoke(caller, linkId);

            verify(projects, never()).findById(any(), any());
            verify(repo, never()).revoke(any(), any());
        }

        @Test
        void non_member_cannot_revoke_throws_propagates() {
            var caller = UUID.randomUUID();
            var linkId = UUID.randomUUID();
            var projectId = UUID.randomUUID();
            var entity = stubSavedEntity(projectId);
            when(repo.findById(eq(linkId))).thenReturn(Optional.of(entity));
            when(projects.findById(eq(projectId), eq(caller)))
                    .thenThrow(new RuntimeException("PROJECT_NOT_FOUND"));

            assertThatThrownBy(() -> service.revoke(caller, linkId))
                    .isInstanceOf(RuntimeException.class);
            verify(repo, never()).revoke(any(), any());
        }
    }

    @Nested
    @DisplayName("read — pre-snapshot validation")
    class Read {

        @Test
        void unknown_token_throws_share_link_not_found() {
            var token = UUID.randomUUID();
            when(repo.findByTokenAndRevokedAtIsNull(eq(token))).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.read(token, OffsetDateTime.now()))
                    .isInstanceOf(ShareLinkNotFoundException.class)
                    .hasMessageContaining("not found");
            verifyNoInteractions(jdbc);
        }

        @Test
        void expired_link_throws_before_snapshot_query() {
            // Boundary: expiresAt strictly before now → expired.
            var token = UUID.randomUUID();
            var entity = stubSavedEntityWithExpiry(
                    UUID.randomUUID(), token,
                    OffsetDateTime.now().minusMinutes(1));
            when(repo.findByTokenAndRevokedAtIsNull(eq(token))).thenReturn(Optional.of(entity));

            assertThatThrownBy(() -> service.read(token, OffsetDateTime.now()))
                    .isInstanceOf(ShareLinkNotFoundException.class)
                    .hasMessageContaining("expired");
            verifyNoInteractions(jdbc);
        }

        @Test
        void null_expiry_means_never_expires() {
            // No expiry → snapshot fetch attempted (will go to JdbcTemplate
            // mock which returns null → "project deleted" path).
            var token = UUID.randomUUID();
            var entity = stubSavedEntityWithExpiry(
                    UUID.randomUUID(), token, null);
            when(repo.findByTokenAndRevokedAtIsNull(eq(token))).thenReturn(Optional.of(entity));
            when(jdbc.queryForObject(anyString(), any(org.springframework.jdbc.core.RowMapper.class),
                    any(Object[].class)))
                    .thenThrow(new org.springframework.dao.EmptyResultDataAccessException(1));

            assertThatThrownBy(() -> service.read(token, OffsetDateTime.now()))
                    .isInstanceOf(ShareLinkNotFoundException.class)
                    .hasMessageContaining("project deleted");
        }
    }

    // ── helpers ───────────────────────────────────────────────────────

    private void stubMember(UUID projectId, UUID callerId) {
        when(projects.findById(eq(projectId), eq(callerId))).thenReturn(new Project(
                projectId, UUID.randomUUID(), "main", "Main",
                null, callerId,
                OffsetDateTime.now(), OffsetDateTime.now(),
                "1.0"));
    }

    private ShareLinkEntity stubSavedEntity(UUID projectId) {
        return stubSavedEntityWithExpiry(projectId, UUID.randomUUID(), null);
    }

    private ShareLinkEntity stubSavedEntityWithExpiry(UUID projectId, UUID token,
                                                       OffsetDateTime expiresAt) {
        // ShareLinkEntity has package-private setters via reflection
        // through JPA; for a unit test we construct via the package
        // ctor + field reflection to satisfy ShareLink#toDto.
        try {
            var entity = new ShareLinkEntity(projectId, null, "table",
                    expiresAt, UUID.randomUUID());
            // id + token + createdAt come from JPA generated values
            // in production. Set them via reflection so toDto() works.
            setField(entity, "id", UUID.randomUUID());
            setField(entity, "token", token);
            setField(entity, "createdAt", OffsetDateTime.now());
            return entity;
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    private static void setField(Object o, String field, Object val) throws Exception {
        var f = o.getClass().getDeclaredField(field);
        f.setAccessible(true);
        f.set(o, val);
    }
}
