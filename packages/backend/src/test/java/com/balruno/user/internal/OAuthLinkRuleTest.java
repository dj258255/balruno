// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.user.internal;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Pure-function tests for {@link OAuthLinkRule}. Lives inside
 * {@code com.balruno.user.internal} so it can touch package-private
 * collaborators without reflection. Spring Modulith's compile-time
 * boundary check only inspects main sources, so tests sharing a package
 * with internals does not weaken the production rule.
 */
class OAuthLinkRuleTest {

    @Nested
    @DisplayName("Returning user — known (provider, providerUserId)")
    class ReturningUser {

        @Test
        void reuses_existing_link_regardless_of_email() {
            var userId = UUID.randomUUID();
            var linkId = UUID.randomUUID();
            var existing = stubAccount(linkId, userId);

            var decision = OAuthLinkRule.decide(
                    Optional.of(existing), Optional.empty(),
                    null, false);

            assertThat(decision).isInstanceOf(OAuthLinkRule.Decision.ReuseExistingLink.class);
            var reuse = (OAuthLinkRule.Decision.ReuseExistingLink) decision;
            assertThat(reuse.userId()).isEqualTo(userId);
            assertThat(reuse.oauthAccountId()).isEqualTo(linkId);
        }
    }

    @Nested
    @DisplayName("Unverified provider email — never auto-link")
    class UnverifiedProvider {

        @Test
        void creates_user_when_no_existing_email_match() {
            var decision = OAuthLinkRule.decide(
                    Optional.empty(), Optional.empty(),
                    "alice@example.com", false);

            assertThat(decision).isInstanceOf(OAuthLinkRule.Decision.CreateNewUser.class);
        }

        @Test
        void rejects_when_an_existing_user_owns_that_email() {
            var existingUser = stubUser(UUID.randomUUID(), true);

            var decision = OAuthLinkRule.decide(
                    Optional.empty(), Optional.of(existingUser),
                    "alice@example.com", false);

            assertThat(decision).isInstanceOf(OAuthLinkRule.Decision.RejectUnverifiedEmail.class);
            var reject = (OAuthLinkRule.Decision.RejectUnverifiedEmail) decision;
            assertThat(reject.email()).isEqualTo("alice@example.com");
        }

        @Test
        void treats_null_email_like_unverified() {
            var decision = OAuthLinkRule.decide(
                    Optional.empty(), Optional.empty(),
                    null, true);

            assertThat(decision).isInstanceOf(OAuthLinkRule.Decision.CreateNewUser.class);
        }
    }

    @Nested
    @DisplayName("Verified provider email — auto-link only against verified user")
    class VerifiedProvider {

        @Test
        void links_to_existing_verified_user() {
            var userId = UUID.randomUUID();
            var existingUser = stubUser(userId, true);

            var decision = OAuthLinkRule.decide(
                    Optional.empty(), Optional.of(existingUser),
                    "alice@example.com", true);

            assertThat(decision).isInstanceOf(OAuthLinkRule.Decision.LinkToExistingUser.class);
            var link = (OAuthLinkRule.Decision.LinkToExistingUser) decision;
            assertThat(link.userId()).isEqualTo(userId);
        }

        @Test
        void rejects_when_existing_user_has_unverified_email_on_our_side() {
            var existingUser = stubUser(UUID.randomUUID(), false);

            var decision = OAuthLinkRule.decide(
                    Optional.empty(), Optional.of(existingUser),
                    "alice@example.com", true);

            assertThat(decision).isInstanceOf(OAuthLinkRule.Decision.RejectUnverifiedEmail.class);
        }

        @Test
        void creates_new_user_when_email_is_unknown() {
            var decision = OAuthLinkRule.decide(
                    Optional.empty(), Optional.empty(),
                    "newcomer@example.com", true);

            assertThat(decision).isInstanceOf(OAuthLinkRule.Decision.CreateNewUser.class);
        }
    }

    // ── helpers ─────────────────────────────────────────────────────────

    private static UserEntity stubUser(UUID id, boolean emailVerified) {
        var u = new UserEntity("stub@example.com", emailVerified, "Stub", null);
        try {
            var f = UserEntity.class.getDeclaredField("id");
            f.setAccessible(true);
            f.set(u, id);
        } catch (ReflectiveOperationException e) {
            throw new AssertionError("Failed to set test id", e);
        }
        return u;
    }

    private static OAuthAccountEntity stubAccount(UUID id, UUID userId) {
        var a = new OAuthAccountEntity();   // accessible via package
        try {
            var idField = OAuthAccountEntity.class.getDeclaredField("id");
            idField.setAccessible(true);
            idField.set(a, id);
            var userField = OAuthAccountEntity.class.getDeclaredField("userId");
            userField.setAccessible(true);
            userField.set(a, userId);
        } catch (ReflectiveOperationException e) {
            throw new AssertionError("Failed to set test fields", e);
        }
        return a;
    }
}
