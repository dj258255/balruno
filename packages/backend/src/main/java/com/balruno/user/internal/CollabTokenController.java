// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.user.internal;

import com.balruno.user.CollabTokenService;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.UUID;

/**
 * {@code POST /api/v1/auth/collab-token} — mints a Hocuspocus session
 * token for the authenticated caller.
 *
 * Wire shape:
 *   request:  {@code { documentId: UUID }}
 *   response: {@code { collabToken: <JWT>, expiresAt: <ISO timestamp> }}
 *
 * The frontend calls this right before opening a Y.Doc; the token
 * carries the {@code doc} claim that the Hocuspocus container then
 * checks against the URL it receives during handshake (the same
 * documentId can be in both, mismatched documentId rejects the
 * connection — packages/collab/src/auth.ts).
 *
 * Membership check: the issuer signs whatever (userId, documentId) the
 * caller asks for. The membership-vs-document check belongs here in
 * the future — once the document directory module surfaces a "is this
 * doc in a workspace I'm a member of?" query, this controller adds it
 * before the issue() call. Today the call only verifies the JWT
 * subject (i.e. the user is logged in), not their access to the
 * specific document. ADR 0017 §4 follow-up.
 */
@RestController
@Tag(name = "Auth")
@SecurityRequirement(name = "bearerAuth")
class CollabTokenController {

    private final CollabTokenService service;

    CollabTokenController(CollabTokenService service) {
        this.service = service;
    }

    @PostMapping(path = "/auth/collab-token", version = "1")
    Response issue(@AuthenticationPrincipal Jwt jwt,
                   @Valid @RequestBody Request body) {
        var userId = UUID.fromString(jwt.getSubject());
        var issued = service.issue(userId, body.documentId());
        return new Response(issued.token(), issued.expiresAt());
    }

    record Request(@NotNull UUID documentId) {}

    record Response(String collabToken, Instant expiresAt) {}
}
