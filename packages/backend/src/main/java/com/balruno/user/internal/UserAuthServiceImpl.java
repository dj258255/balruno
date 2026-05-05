// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.user.internal;

import com.balruno.user.AuthenticatedUser;
import com.balruno.user.OAuthLogin;
import com.balruno.user.UserAuthException;
import com.balruno.user.UserAuthService;
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

    UserAuthServiceImpl(UserRepository userRepo, OAuthAccountRepository oauthRepo) {
        this.userRepo = userRepo;
        this.oauthRepo = oauthRepo;
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
