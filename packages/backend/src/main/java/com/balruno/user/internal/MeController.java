// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.user.internal;

import com.balruno.user.AuthenticatedUser;
import com.balruno.user.UserAuthService;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * The {@code /api/v1/me} endpoint — returns the user described by the
 * caller's JWT. Answers 200 for a valid token and 401 otherwise; the
 * controller reads the principal directly from the resource-server
 * filter chain, no extra wiring needed.
 */
@RestController
@RequestMapping("/api/v1")
@Tag(name = "User")
@SecurityRequirement(name = "bearerAuth")
class MeController {

    private final UserAuthService userAuthService;

    MeController(UserAuthService userAuthService) {
        this.userAuthService = userAuthService;
    }

    @GetMapping("/me")
    AuthenticatedUser me(@AuthenticationPrincipal Jwt jwt) {
        var userId = UUID.fromString(jwt.getSubject());
        return userAuthService.findById(userId);
    }
}
