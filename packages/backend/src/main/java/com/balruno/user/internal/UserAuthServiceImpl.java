// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.user.internal;

import com.balruno.user.AuthenticatedUser;
import com.balruno.user.OAuthLogin;
import com.balruno.user.UserAuthException;
import com.balruno.user.UserAuthService;
import com.balruno.user.UserCreatedEvent;
import com.balruno.workspace.WorkspaceService;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.NoSuchElementException;
import java.util.Optional;
import java.util.UUID;

/**
 * Glue between the pure {@link OAuthLinkRule} and the JPA layer. The rule
 * decides; this class executes — every Decision case maps to exactly one
 * persistence path.
 */
@Service
@Transactional
class UserAuthServiceImpl implements UserAuthService {

    private final UserRepository userRepo;
    private final OAuthAccountRepository oauthRepo;
    private final WorkspaceService workspaceService;
    private final ApplicationEventPublisher events;
    private final com.balruno.storage.StorageService storage;

    UserAuthServiceImpl(UserRepository userRepo, OAuthAccountRepository oauthRepo,
                        WorkspaceService workspaceService,
                        ApplicationEventPublisher events,
                        com.balruno.storage.StorageService storage) {
        this.userRepo = userRepo;
        this.oauthRepo = oauthRepo;
        this.workspaceService = workspaceService;
        this.events = events;
        this.storage = storage;
    }

    @Override
    public AuthenticatedUser findOrCreateOnOAuth(OAuthLogin login) {
        var existingLink = oauthRepo.findByProviderAndProviderUserId(
                login.provider(), login.providerUserId());

        Optional<UserEntity> existingByEmail = login.email() == null
                ? Optional.empty()
                : userRepo.findByEmailIgnoreCase(login.email());

        var decision = OAuthLinkRule.decide(
                existingLink, existingByEmail,
                login.email(), login.emailVerified());

        var user = switch (decision) {
            case OAuthLinkRule.Decision.ReuseExistingLink reuse -> {
                var u = loadUser(reuse.userId());
                u.recordLogin();
                yield u;
            }
            case OAuthLinkRule.Decision.LinkToExistingUser link -> {
                var u = loadUser(link.userId());
                oauthRepo.save(new OAuthAccountEntity(
                        u.getId(),
                        login.provider(),
                        login.providerUserId(),
                        login.email(),
                        login.emailVerified()));
                u.updateProfile(login.name(), login.avatarUrl());
                u.recordLogin();
                yield u;
            }
            case OAuthLinkRule.Decision.CreateNewUser ignored -> {
                var u = new UserEntity(
                        login.email(),
                        login.emailVerified(),
                        login.name(),
                        login.avatarUrl());
                u = userRepo.save(u);
                oauthRepo.save(new OAuthAccountEntity(
                        u.getId(),
                        login.provider(),
                        login.providerUserId(),
                        login.email(),
                        login.emailVerified()));
                u.recordLogin();

                // Auto-create a default workspace so the SPA never lands
                // the user on an empty home (Notion / Linear / Vercel
                // pattern). Slug derives from the email local-part with
                // numeric-suffix fallback on collision; name takes the
                // user's display name when available.
                var slugBase = localPartOf(login.email());
                var displayName = login.name() != null && !login.name().isBlank()
                        ? login.name()
                        : (slugBase != null ? slugBase : "Your");
                var workspace = workspaceService.createDefaultFor(
                        u.getId(),
                        slugBase,
                        displayName + "'s Workspace");

                // Hand off the default-project seeding to the project
                // module via a UserCreatedEvent. The listener runs
                // AFTER_COMMIT, so the user + workspace rows are already
                // committed when the starter pack write begins — if it
                // fails the user can still sign in to an empty
                // workspace (and re-seed via the empty-state path) and
                // the user module stays free of project imports.
                events.publishEvent(new UserCreatedEvent(
                        u.getId(),
                        workspace.id(),
                        "main",
                        "내 첫 게임",
                        u.getLocale()));

                yield u;
            }
            case OAuthLinkRule.Decision.RejectUnverifiedEmail r -> throw new UserAuthException(
                    UserAuthException.Reason.UNVERIFIED_EMAIL_CONFLICT,
                    "An account with this email exists but the provider could not "
                  + "verify the address. Verify the email with the provider, or "
                  + "sign in with the original method.");
        };

        return toDto(user);
    }

    @Override
    @Transactional(readOnly = true)
    public AuthenticatedUser findById(UUID userId) {
        return toDto(loadUser(userId));
    }

    @Override
    public AuthenticatedUser updateProfile(UUID userId, String name, String avatarUrl) {
        var user = loadUser(userId);
        if (name != null) {
            var trimmed = name.trim();
            if (trimmed.isEmpty()) {
                throw new com.balruno.user.UserAuthException(
                        com.balruno.user.UserAuthException.Reason.INVALID_PROFILE,
                        "name must not be blank");
            }
            if (trimmed.length() > 120) {
                // users.name VARCHAR(120) — same cap.
                throw new com.balruno.user.UserAuthException(
                        com.balruno.user.UserAuthException.Reason.INVALID_PROFILE,
                        "name must be 120 characters or fewer");
            }
            user.updateProfile(trimmed, user.getAvatarUrl());
        }
        if (avatarUrl != null) {
            // null is "unchanged"; empty string is "clear back to OAuth default"
            // — both honoured here.
            var url = avatarUrl.isBlank() ? null : avatarUrl;
            // Avatar URLs that the user can set must come from our own
            // /media/avatars/ surface (returned by the upload endpoint).
            // OAuth-supplied URLs (avatars.githubusercontent.com etc.)
            // are written by the OAuth login flow, not via this method.
            if (url != null && !url.startsWith("/media/avatars/")) {
                throw new com.balruno.user.UserAuthException(
                        com.balruno.user.UserAuthException.Reason.INVALID_PROFILE,
                        "avatarUrl must be a /media/avatars/ path");
            }
            if (url != null && url.length() > 2048) {
                throw new com.balruno.user.UserAuthException(
                        com.balruno.user.UserAuthException.Reason.INVALID_PROFILE,
                        "avatarUrl exceeds 2048 characters");
            }
            // Capture the previous /media/avatars/ blob (if any) BEFORE
            // we mutate the entity — once user.updateProfile runs the
            // old URL is gone. Slack / Linear / Notion all keep a single
            // avatar slot per user; this matches that pattern by deleting
            // the now-unreferenced blob from R2 / LocalFs after commit.
            var previous = user.getAvatarUrl();
            user.updateProfile(user.getName(), url);
            if (previous != null
                    && previous.startsWith("/media/avatars/")
                    && !previous.equals(url)) {
                deleteAvatarBlobAfterCommit(previous);
            }
        }
        return toDto(user);
    }

    /**
     * Schedule the orphan avatar delete after the surrounding tx
     * commits — same pattern CommentServiceImpl uses for wss + webhook
     * fanout. A rolled-back updateProfile must not delete the old
     * blob; failure during delete must not roll back the user mutation.
     */
    private void deleteAvatarBlobAfterCommit(String mediaUrl) {
        // mediaUrl is "/media/avatars/{userId}/{hash}.{ext}" — strip
        // the "/media/" prefix to get the StorageService key.
        var path = mediaUrl.startsWith("/media/")
                ? mediaUrl.substring("/media/".length())
                : mediaUrl;
        org.springframework.transaction.support.TransactionSynchronizationManager
                .registerSynchronization(
                        new org.springframework.transaction.support.TransactionSynchronization() {
                            @Override
                            public void afterCommit() {
                                try {
                                    storage.delete(path);
                                } catch (Exception e) {
                                    // Orphan is benign — re-upload of
                                    // same image returns same hash so
                                    // re-conflicts on PUT, never breaks
                                    // the user. Worst case: 2MB R2
                                    // leak, swept by future R2
                                    // lifecycle rule.
                                }
                            }
                        });
    }

    /** Pulls the local-part out of an email, or returns null when absent. */
    private static String localPartOf(String email) {
        if (email == null) return null;
        var at = email.indexOf('@');
        return at > 0 ? email.substring(0, at) : null;
    }

    private UserEntity loadUser(UUID id) {
        return userRepo.findById(id)
                .orElseThrow(() -> new NoSuchElementException("user " + id + " not found"));
    }

    private static AuthenticatedUser toDto(UserEntity u) {
        return new AuthenticatedUser(
                u.getId(),
                u.getEmail(),
                u.getName(),
                u.getAvatarUrl(),
                u.getLocale());
    }
}
