// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.user.internal;

import java.util.Optional;
import java.util.UUID;

/**
 * Decides what to do on an inbound OAuth login. Pure function — no DB
 * access, no side effects, no Spring beans. Service code does the lookups,
 * passes the results in, and acts on the {@link Decision}.
 *
 * The verified-email auto-link rule (Notion / Linear / Vercel pattern):
 *
 * <ol>
 *   <li>If we already linked this {@code (provider, providerUserId)} → reuse.
 *   <li>If the provider's email is missing or unverified, never auto-link.
 *   <li>If a different user owns that email, REJECT — would-be takeover via
 *       an unverified second provider against a verified primary.
 *   <li>If the email matches an existing user AND both sides are verified,
 *       link a fresh oauth_accounts row to that user.
 *   <li>Otherwise, create a brand-new user.
 * </ol>
 *
 * GitHub and Google both surface only verified emails through OAuth, so in
 * practice rule (3) almost never fires — but we still want REJECT to be the
 * default for the "verified primary, unverified attacker" scenario rather
 * than silently creating a duplicate user.
 */
final class OAuthLinkRule {

    private OAuthLinkRule() {}

    sealed interface Decision {
        record ReuseExistingLink(UUID userId, UUID oauthAccountId) implements Decision {}
        record LinkToExistingUser(UUID userId) implements Decision {}
        record CreateNewUser() implements Decision {}
        record RejectUnverifiedEmail(String email) implements Decision {}
    }

    static Decision decide(
            Optional<OAuthAccountEntity> existingLink,
            Optional<UserEntity> existingUserByEmail,
            String providerEmail,
            boolean providerEmailVerified) {

        if (existingLink.isPresent()) {
            var link = existingLink.get();
            return new Decision.ReuseExistingLink(link.getUserId(), link.getId());
        }

        if (providerEmail == null || !providerEmailVerified) {
            // Without a verified email we have nothing to match against. The
            // existingUserByEmail lookup is irrelevant — even if it succeeded,
            // we wouldn't trust it.
            return existingUserByEmail.isPresent()
                    ? new Decision.RejectUnverifiedEmail(providerEmail)
                    : new Decision.CreateNewUser();
        }

        if (existingUserByEmail.isEmpty()) {
            return new Decision.CreateNewUser();
        }

        var user = existingUserByEmail.get();
        if (!user.isEmailVerified()) {
            // Existing user has the email but it isn't verified on our side.
            // We don't have an OAuth-only path that registers an unverified
            // email today, but defend against it anyway — refuse to link.
            return new Decision.RejectUnverifiedEmail(providerEmail);
        }

        return new Decision.LinkToExistingUser(user.getId());
    }
}
