// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.user.internal;

import com.balruno.security.Principals;

import com.balruno.user.AuthenticatedUser;
import com.balruno.user.UserAuthService;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * The {@code /api/v1/me} endpoint — returns the user described by the
 * caller's JWT. Answers 200 for a valid token and 401 otherwise; the
 * controller reads the principal directly from the resource-server
 * filter chain, no extra wiring needed.
 */
@RestController
@Tag(name = "User")
@SecurityRequirement(name = "bearerAuth")
class MeController {

    private final UserAuthService userAuthService;

    MeController(UserAuthService userAuthService) {
        this.userAuthService = userAuthService;
    }

    @GetMapping(path = "/me", version = "1")
    AuthenticatedUser me(@AuthenticationPrincipal Jwt jwt) {
        var userId = Principals.userId(jwt);
        return userAuthService.findById(userId);
    }

    /**
     * Profile edit — display name and / or avatar URL. Either field
     * may be omitted (or {@code null} in JSON) to leave that side
     * untouched. Empty-string {@code avatarUrl} clears the avatar
     * back to the OAuth default; empty-string {@code name} is
     * rejected (a name is always required for rendering).
     *
     * The avatar URL must be one returned by {@code POST
     * /api/v1/uploads/avatar} so users can't point us at arbitrary
     * external hosts.
     */
    @PatchMapping(path = "/me", version = "1")
    AuthenticatedUser updateMe(
            @AuthenticationPrincipal Jwt jwt,
            @RequestBody UpdateProfileRequest body) {
        var userId = Principals.userId(jwt);
        return userAuthService.updateProfile(userId, body.name(), body.avatarUrl());
    }

    record UpdateProfileRequest(String name, String avatarUrl) {}
}
