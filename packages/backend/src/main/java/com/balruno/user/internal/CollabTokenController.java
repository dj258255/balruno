// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.user.internal;

import com.balruno.user.CollabTokenService;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

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
 * Membership check: before issuing, ask the directory module whether
 * this user is a member of the workspace owning the document's project.
 * Failure returns 404 (not 403) so callers cannot enumerate document
 * IDs by observing different responses for "exists but not yours" vs
 * "doesn't exist" (IDOR defence). Hocuspocus itself only verifies the
 * JWT signature + the doc claim against the connected URL, so this
 * gate is the single point of authorisation in the chain.
 */
@RestController
@Tag(name = "Auth")
@SecurityRequirement(name = "bearerAuth")
class CollabTokenController {

    private final CollabTokenService service;
    private final CollabAccessQueries access;

    CollabTokenController(CollabTokenService service, CollabAccessQueries access) {
        this.service = service;
        this.access = access;
    }

    @PostMapping(path = "/auth/collab-token", version = "1")
    Response issue(@AuthenticationPrincipal Jwt jwt,
                   @Valid @RequestBody Request body) {
        var userId = UUID.fromString(jwt.getSubject());
        if (!access.canUserAccessDocument(userId, body.documentId())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        }
        var issued = service.issue(userId, body.documentId());
        return new Response(issued.token(), issued.expiresAt());
    }

    record Request(@NotNull UUID documentId) {}

    record Response(String collabToken, Instant expiresAt) {}
}
