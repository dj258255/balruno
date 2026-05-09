// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.project.internal;

import com.balruno.security.Principals;

import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/**
 * Stage F — "Add from template" REST surface (ADR 0020).
 *
 * Two endpoints:
 *   - GET /v1/catalog?locale=ko       — list importable starter groups
 *   - POST /v1/projects/{id}/templates/{groupId}?locale=ko
 *                                     — graft one group onto a project
 *
 * Auth: bearer JWT, member of the project's workspace. The list
 * endpoint is open to any authenticated caller (catalog metadata is
 * not project-scoped). The import endpoint goes through
 * {@link TemplateImportService#apply} which checks membership before
 * mutating.
 *
 * The list response shape is intentionally minimal — id / name /
 * description / color / sheetCount — so the modal UI can render
 * cards without fetching the full sheet bodies. The import endpoint
 * returns 204 because peers (and the caller themselves) get the new
 * state via the broadcast {@code sync.full} frame on their existing
 * WebSocket; HTTP doesn't need to ship the post-mutation snapshot.
 */
@RestController
@Tag(name = "Template")
@SecurityRequirement(name = "bearerAuth")
class TemplateController {

    private final TemplateImportService templates;

    TemplateController(TemplateImportService templates) {
        this.templates = templates;
    }

    @GetMapping(path = "/catalog", version = "1")
    List<StarterPackSeeder.GroupSummary> listCatalog(
            @RequestParam(name = "locale", required = false) String locale) {
        return templates.listGroups(locale);
    }

    @PostMapping(path = "/projects/{id}/templates/{groupId}", version = "1")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void importTemplate(@AuthenticationPrincipal Jwt jwt,
                        @PathVariable UUID id,
                        @PathVariable String groupId,
                        @RequestParam(name = "locale", required = false) String locale) {
        templates.apply(id, callerId(jwt), groupId, locale);
    }

    private static UUID callerId(Jwt jwt) {
        return Principals.userId(jwt);
    }
}
