// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.share.internal;

import com.balruno.share.ShareLink;
import com.balruno.share.ShareService;
import com.fasterxml.jackson.databind.JsonNode;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/**
 * REST surface for share links (ADR 0027).
 *
 *   POST   /v1/projects/{id}/share-links     — create (member only)
 *   GET    /v1/projects/{id}/share-links     — list   (member only)
 *   DELETE /v1/share-links/{id}              — revoke (member only)
 *   GET    /v1/share-public/{token}          — public read (no auth)
 *
 * Public-read path is configured `permitAll` in SecurityConfig — the
 * only credential is the URL token itself.
 */
@RestController
@Tag(name = "ShareLink")
class ShareController {

    private final ShareService shares;

    ShareController(ShareService shares) {
        this.shares = shares;
    }

    @PostMapping(path = "/projects/{projectId}/share-links", version = "1")
    @ResponseStatus(HttpStatus.CREATED)
    @SecurityRequirement(name = "bearerAuth")
    ShareLink create(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID projectId,
            @RequestBody @Valid CreateRequest body) {
        return shares.create(callerId(jwt), new ShareService.CreateRequest(
                projectId,
                body.sheetId(),
                body.activeView(),
                body.expiresAt()));
    }

    @GetMapping(path = "/projects/{projectId}/share-links", version = "1")
    @SecurityRequirement(name = "bearerAuth")
    List<ShareLink> list(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID projectId) {
        return shares.listForProject(callerId(jwt), projectId);
    }

    @DeleteMapping(path = "/share-links/{id}", version = "1")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @SecurityRequirement(name = "bearerAuth")
    void revoke(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        shares.revoke(callerId(jwt), id);
    }

    @GetMapping(path = "/share-public/{token}", version = "1")
    PublicReadResponse readPublic(@PathVariable UUID token) {
        var result = shares.read(token, OffsetDateTime.now());
        return new PublicReadResponse(result.link(), result.projectSnapshot());
    }

    private static UUID callerId(Jwt jwt) {
        return UUID.fromString(jwt.getSubject());
    }

    /** Wire model for POST /share-links. The body fields all default
     *  to null — every pin is optional. */
    record CreateRequest(
            UUID sheetId,
            String activeView,
            OffsetDateTime expiresAt
    ) {}

    /** Public read envelope. Carries both the link metadata (for the
     *  viewer header) and the project snapshot (for the body). */
    record PublicReadResponse(
            @NotNull ShareLink link,
            @NotNull JsonNode projectSnapshot
    ) {}
}
