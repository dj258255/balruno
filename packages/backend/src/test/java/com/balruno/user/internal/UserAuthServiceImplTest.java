// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.user.internal;

import com.balruno.user.OAuthLogin;
import com.balruno.user.OAuthProvider;
import com.balruno.user.UserAuthException;
import com.balruno.workspace.Workspace;
import com.balruno.workspace.WorkspaceService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.lang.reflect.Field;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.NoSuchElementException;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * UserAuthServiceImpl unit tests, organised by scenario.
 *
 * The actual {@link OAuthLinkRule} is package-private and pure — it is
 * invoked rather than mocked, so the suite verifies the full
 * lookup-decide-persist pipeline with only the JPA repositories and the
 * cross-module {@link WorkspaceService} replaced by Mockito stubs.
 */
@ExtendWith(MockitoExtension.class)
class UserAuthServiceImplTest {

    @Mock UserRepository userRepo;
    @Mock OAuthAccountRepository oauthRepo;
    @Mock WorkspaceService workspaceService;
    @InjectMocks UserAuthServiceImpl service;

    // ── Happy ──────────────────────────────────────────────────────────

    @Nested
    @DisplayName("Happy")
    class Happy {

        @Test
        void existing_oauth_account_returns_existing_user_and_records_login() {
            var userId = UUID.randomUUID();
            var existing = stubUser(userId, "ada@example.com", "Ada", "https://avatar/a.png", true);
            var link = stubAccount(UUID.randomUUID(), userId, OAuthProvider.GITHUB, "gh-1");
            when(oauthRepo.findByProviderAndProviderUserId(OAuthProvider.GITHUB, "gh-1"))
                    .thenReturn(Optional.of(link));
            when(userRepo.findById(userId)).thenReturn(Optional.of(existing));

            var dto = service.findOrCreateOnOAuth(new OAuthLogin(
                    OAuthProvider.GITHUB, "gh-1", "ada@example.com", true, "Ada", "https://avatar/a.png"));

            assertThat(dto.id()).isEqualTo(userId);
            assertThat(existing.getLastLoginAt()).isNotNull();
            verify(userRepo, never()).save(any());
            verify(workspaceService, never()).createDefaultFor(any(), any(), any());
        }

        @Test
        void verified_email_match_links_new_provider_to_existing_user() {
            var userId = UUID.randomUUID();
            var existingUser = stubUser(userId, "alice@example.com", "Alice", null, true);
            when(oauthRepo.findByProviderAndProviderUserId(OAuthProvider.GOOGLE, "g-1"))
                    .thenReturn(Optional.empty());
            when(userRepo.findByEmailIgnoreCase("alice@example.com"))
                    .thenReturn(Optional.of(existingUser));
            when(userRepo.findById(userId)).thenReturn(Optional.of(existingUser));

            var dto = service.findOrCreateOnOAuth(new OAuthLogin(
                    OAuthProvider.GOOGLE, "g-1", "alice@example.com", true,
                    "Alice from Google", "https://google/avatar"));

            assertThat(dto.id()).isEqualTo(userId);
            verify(oauthRepo).save(any(OAuthAccountEntity.class)); // new link inserted
            verify(workspaceService, never()).createDefaultFor(any(), any(), any());
            // Display profile updated to whatever the new provider returned.
            assertThat(existingUser.getName()).isEqualTo("Alice from Google");
            assertThat(existingUser.getAvatarUrl()).isEqualTo("https://google/avatar");
        }

        @Test
        void brand_new_user_creates_user_oauth_account_and_default_workspace() {
            when(oauthRepo.findByProviderAndProviderUserId(OAuthProvider.GITHUB, "gh-9"))
                    .thenReturn(Optional.empty());
            when(userRepo.findByEmailIgnoreCase("newcomer@example.com"))
                    .thenReturn(Optional.empty());
            when(userRepo.save(any(UserEntity.class))).thenAnswer(inv -> {
                UserEntity e = inv.getArgument(0);
                setField(e, "id", UUID.randomUUID());
                return e;
            });

            var dto = service.findOrCreateOnOAuth(new OAuthLogin(
                    OAuthProvider.GITHUB, "gh-9", "newcomer@example.com", true, "Newcomer", null));

            assertThat(dto.email()).isEqualTo("newcomer@example.com");
            verify(oauthRepo).save(any(OAuthAccountEntity.class));
            // Default workspace creation kicks in for new users.
            var slugCaptor = ArgumentCaptor.forClass(String.class);
            var nameCaptor = ArgumentCaptor.forClass(String.class);
            verify(workspaceService).createDefaultFor(eq(dto.id()), slugCaptor.capture(), nameCaptor.capture());
            assertThat(slugCaptor.getValue()).isEqualTo("newcomer");      // email local-part
            assertThat(nameCaptor.getValue()).isEqualTo("Newcomer's Workspace");
        }
    }

    // ── Boundary ───────────────────────────────────────────────────────

    @Nested
    @DisplayName("Boundary")
    class Boundary {

        @Test
        void email_lookup_is_case_insensitive() {
            // The link rule treats the lookup result as canonical. Verify
            // that the service goes through the case-insensitive query.
            var userId = UUID.randomUUID();
            var existing = stubUser(userId, "Ada@Example.COM", "Ada", null, true);
            when(oauthRepo.findByProviderAndProviderUserId(OAuthProvider.GOOGLE, "g-2"))
                    .thenReturn(Optional.empty());
            when(userRepo.findByEmailIgnoreCase("ada@example.com"))
                    .thenReturn(Optional.of(existing));
            when(userRepo.findById(userId)).thenReturn(Optional.of(existing));

            service.findOrCreateOnOAuth(new OAuthLogin(
                    OAuthProvider.GOOGLE, "g-2", "ada@example.com", true, "Ada", null));

            verify(userRepo).findByEmailIgnoreCase("ada@example.com");
        }

        @Test
        void findById_returns_DTO_for_existing_user() {
            var userId = UUID.randomUUID();
            var u = stubUser(userId, "x@y.z", "X", null, true);
            when(userRepo.findById(userId)).thenReturn(Optional.of(u));

            var dto = service.findById(userId);

            assertThat(dto.id()).isEqualTo(userId);
        }

        @Test
        void findById_throws_NoSuchElementException_when_missing() {
            var userId = UUID.randomUUID();
            when(userRepo.findById(userId)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.findById(userId))
                    .isInstanceOf(NoSuchElementException.class);
        }
    }

    // ── Edge ───────────────────────────────────────────────────────────

    @Nested
    @DisplayName("Edge")
    class Edge {

        @Test
        void null_email_skips_email_lookup_and_creates_new_user() {
            when(oauthRepo.findByProviderAndProviderUserId(OAuthProvider.GITHUB, "gh-no-email"))
                    .thenReturn(Optional.empty());
            when(userRepo.save(any(UserEntity.class))).thenAnswer(inv -> {
                UserEntity e = inv.getArgument(0);
                setField(e, "id", UUID.randomUUID());
                return e;
            });

            service.findOrCreateOnOAuth(new OAuthLogin(
                    OAuthProvider.GITHUB, "gh-no-email", null, false, "No Email", null));

            verify(userRepo, never()).findByEmailIgnoreCase(any());
            verify(userRepo).save(any(UserEntity.class));
        }

        @Test
        void blank_name_falls_back_to_email_local_part() {
            when(oauthRepo.findByProviderAndProviderUserId(OAuthProvider.GITHUB, "gh-blank"))
                    .thenReturn(Optional.empty());
            when(userRepo.findByEmailIgnoreCase("alice@x.com")).thenReturn(Optional.empty());
            when(userRepo.save(any(UserEntity.class))).thenAnswer(inv -> {
                UserEntity e = inv.getArgument(0);
                setField(e, "id", UUID.randomUUID());
                return e;
            });

            service.findOrCreateOnOAuth(new OAuthLogin(
                    OAuthProvider.GITHUB, "gh-blank", "alice@x.com", true, "  ", null));

            var nameCaptor = ArgumentCaptor.forClass(String.class);
            verify(workspaceService).createDefaultFor(any(), eq("alice"), nameCaptor.capture());
            // Display name falls back to local-part instead of "  ".
            assertThat(nameCaptor.getValue()).isEqualTo("alice's Workspace");
        }

        @Test
        void null_email_and_null_name_uses_Your_Workspace_fallback() {
            when(oauthRepo.findByProviderAndProviderUserId(OAuthProvider.GITHUB, "gh-anon"))
                    .thenReturn(Optional.empty());
            when(userRepo.save(any(UserEntity.class))).thenAnswer(inv -> {
                UserEntity e = inv.getArgument(0);
                setField(e, "id", UUID.randomUUID());
                return e;
            });

            service.findOrCreateOnOAuth(new OAuthLogin(
                    OAuthProvider.GITHUB, "gh-anon", null, false, null, null));

            verify(workspaceService).createDefaultFor(any(), eq(null), eq("Your's Workspace"));
        }

        @Test
        void unverified_provider_email_when_no_existing_user_creates_new_user() {
            // Link rule's CreateNewUser branch when email is unverified
            // AND nothing else matches that address.
            when(oauthRepo.findByProviderAndProviderUserId(OAuthProvider.GITHUB, "gh-uv"))
                    .thenReturn(Optional.empty());
            when(userRepo.findByEmailIgnoreCase("unv@x.com")).thenReturn(Optional.empty());
            when(userRepo.save(any(UserEntity.class))).thenAnswer(inv -> {
                UserEntity e = inv.getArgument(0);
                setField(e, "id", UUID.randomUUID());
                return e;
            });

            var dto = service.findOrCreateOnOAuth(new OAuthLogin(
                    OAuthProvider.GITHUB, "gh-uv", "unv@x.com", false, "Unv", null));

            assertThat(dto.email()).isEqualTo("unv@x.com");
        }
    }

    // ── Corner ─────────────────────────────────────────────────────────

    @Nested
    @DisplayName("Corner")
    class Corner {

        @Test
        void verified_email_against_existing_unverified_account_is_rejected() {
            // Defence-in-depth: even though OAuth providers normally only
            // surface verified emails, the rule still refuses to link when
            // OUR side has the email marked unverified.
            var userId = UUID.randomUUID();
            var existingUnverified = stubUser(userId, "alice@example.com", "Alice", null, false);
            when(oauthRepo.findByProviderAndProviderUserId(OAuthProvider.GOOGLE, "g-uv"))
                    .thenReturn(Optional.empty());
            when(userRepo.findByEmailIgnoreCase("alice@example.com"))
                    .thenReturn(Optional.of(existingUnverified));

            assertThatThrownBy(() -> service.findOrCreateOnOAuth(new OAuthLogin(
                    OAuthProvider.GOOGLE, "g-uv", "alice@example.com", true, "Alice G", null)))
                    .isInstanceOfSatisfying(UserAuthException.class, e ->
                            assertThat(e.reason()).isEqualTo(UserAuthException.Reason.UNVERIFIED_EMAIL_CONFLICT));
        }

        @Test
        void unverified_provider_email_against_existing_user_is_rejected() {
            // Provider says email isn't verified but our DB already owns
            // that email — refuse to link, never auto-merge.
            var userId = UUID.randomUUID();
            var existing = stubUser(userId, "victim@example.com", "Victim", null, true);
            when(oauthRepo.findByProviderAndProviderUserId(OAuthProvider.GITHUB, "attacker"))
                    .thenReturn(Optional.empty());
            when(userRepo.findByEmailIgnoreCase("victim@example.com"))
                    .thenReturn(Optional.of(existing));

            assertThatThrownBy(() -> service.findOrCreateOnOAuth(new OAuthLogin(
                    OAuthProvider.GITHUB, "attacker", "victim@example.com", false, "fake", null)))
                    .isInstanceOfSatisfying(UserAuthException.class, e ->
                            assertThat(e.reason()).isEqualTo(UserAuthException.Reason.UNVERIFIED_EMAIL_CONFLICT));
        }

        @Test
        void linking_does_not_create_a_default_workspace() {
            // The link path implies the user already has a workspace from
            // their original signup — auto-creating a second one would be
            // surprising. Verify it does NOT happen.
            var userId = UUID.randomUUID();
            var existing = stubUser(userId, "alice@example.com", "Alice", null, true);
            when(oauthRepo.findByProviderAndProviderUserId(OAuthProvider.GOOGLE, "g-link"))
                    .thenReturn(Optional.empty());
            when(userRepo.findByEmailIgnoreCase("alice@example.com"))
                    .thenReturn(Optional.of(existing));
            when(userRepo.findById(userId)).thenReturn(Optional.of(existing));

            service.findOrCreateOnOAuth(new OAuthLogin(
                    OAuthProvider.GOOGLE, "g-link", "alice@example.com", true, "Alice G", null));

            verify(workspaceService, never()).createDefaultFor(any(), any(), any());
        }

        @Test
        void second_provider_for_same_user_inserts_separate_oauth_account_row() {
            // Two oauth_accounts (same user, different providers). The
            // existing-link lookup is keyed on (provider, providerUserId)
            // so the GOOGLE side comes back empty, link rule routes to
            // LinkToExistingUser, oauth_account row is added.
            var userId = UUID.randomUUID();
            var existing = stubUser(userId, "alice@example.com", "Alice", null, true);
            when(oauthRepo.findByProviderAndProviderUserId(OAuthProvider.GOOGLE, "g-2nd"))
                    .thenReturn(Optional.empty());
            when(userRepo.findByEmailIgnoreCase("alice@example.com"))
                    .thenReturn(Optional.of(existing));
            when(userRepo.findById(userId)).thenReturn(Optional.of(existing));

            service.findOrCreateOnOAuth(new OAuthLogin(
                    OAuthProvider.GOOGLE, "g-2nd", "alice@example.com", true, "Alice G", null));

            var captor = ArgumentCaptor.forClass(OAuthAccountEntity.class);
            verify(oauthRepo).save(captor.capture());
            assertThat(captor.getValue().getProvider()).isEqualTo(OAuthProvider.GOOGLE);
            assertThat(captor.getValue().getProviderUserId()).isEqualTo("g-2nd");
            assertThat(captor.getValue().getUserId()).isEqualTo(userId);
        }
    }

    // ── helpers ────────────────────────────────────────────────────────

    private static UserEntity stubUser(UUID id, String email, String name, String avatarUrl,
                                       boolean emailVerified) {
        var u = new UserEntity(email, emailVerified, name, avatarUrl);
        var now = OffsetDateTime.now(ZoneOffset.UTC);
        setField(u, "id", id);
        setField(u, "createdAt", now);
        setField(u, "updatedAt", now);
        return u;
    }

    private static OAuthAccountEntity stubAccount(UUID id, UUID userId,
                                                  OAuthProvider provider, String providerUserId) {
        var a = new OAuthAccountEntity(userId, provider, providerUserId, "stub@x.com", true);
        setField(a, "id", id);
        setField(a, "linkedAt", OffsetDateTime.now(ZoneOffset.UTC));
        return a;
    }

    private static void setField(Object target, String name, Object value) {
        try {
            Field f = findField(target.getClass(), name);
            f.setAccessible(true);
            f.set(target, value);
        } catch (ReflectiveOperationException e) {
            throw new AssertionError("set " + name, e);
        }
    }

    private static Field findField(Class<?> clazz, String name) throws NoSuchFieldException {
        for (Class<?> c = clazz; c != null; c = c.getSuperclass()) {
            try { return c.getDeclaredField(name); } catch (NoSuchFieldException ignored) {}
        }
        throw new NoSuchFieldException(name);
    }

    @SuppressWarnings("unused")
    private static Workspace ___unused() { return null; }
}
