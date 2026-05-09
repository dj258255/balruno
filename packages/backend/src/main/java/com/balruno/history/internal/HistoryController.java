// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.history.internal;

import com.balruno.history.HistoryEntry;
import com.balruno.history.HistoryService;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/**
 * GET endpoints for sheet/row/cell change history (ADR 0038 Stage A).
 *
 * Read-only — all writes flow through the sync op listener
 * ({@link HistoryEventListener}).
 */
@RestController
@Tag(name = "History")
@SecurityRequirement(name = "bearerAuth")
class HistoryController {

    private final HistoryService history;

    HistoryController(HistoryService history) {
        this.history = history;
    }

    @GetMapping(
            path = "/projects/{projectId}/sheets/{sheetId}/rows/{rowId}/history",
            version = "1")
    List<HistoryEntry> listForRow(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID projectId,
            @PathVariable UUID sheetId,
            @PathVariable UUID rowId,
            @RequestParam(value = "limit", defaultValue = "100") int limit) {
        return history.listForRow(projectId, sheetId, rowId, callerId(jwt), limit);
    }

    @GetMapping(
            path = "/projects/{projectId}/sheets/{sheetId}/history",
            version = "1")
    List<HistoryEntry> listForSheet(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID projectId,
            @PathVariable UUID sheetId,
            @RequestParam(value = "limit", defaultValue = "100") int limit) {
        return history.listForSheet(projectId, sheetId, callerId(jwt), limit);
    }

    private static UUID callerId(Jwt jwt) {
        return UUID.fromString(jwt.getSubject());
    }
}
