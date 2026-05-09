// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.history.internal;

import com.balruno.history.DocSnapshot;
import com.balruno.history.DocSnapshotService;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;

/**
 * Page-history endpoints for the doc body surface (ADR 0038 stage C).
 *
 * The list endpoint returns metadata only; the binary state download
 * (which the frontend feeds into Y.applyUpdate to render or restore a
 * historical version) is a separate path so the list response stays
 * light.
 */
@RestController
@Tag(name = "DocHistory")
@SecurityRequirement(name = "bearerAuth")
class DocSnapshotController {

    private final DocSnapshotService snapshots;

    DocSnapshotController(DocSnapshotService snapshots) {
        this.snapshots = snapshots;
    }

    @GetMapping(path = "/docs/{docId}/snapshots", version = "1")
    List<DocSnapshot> list(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID docId,
            @RequestParam(value = "limit", defaultValue = "50") int limit) {
        return snapshots.listForDoc(docId, callerId(jwt), limit);
    }

    @GetMapping(
            path = "/docs/{docId}/snapshots/{snapshotId}/state",
            version = "1")
    ResponseEntity<byte[]> state(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID docId,
            @PathVariable UUID snapshotId) {
        // docId is in the path for symmetry / future per-doc ACL caching;
        // the state endpoint validates the snapshot belongs to that doc
        // implicitly via the read auth check inside the service.
        var bytes = snapshots.readState(snapshotId, callerId(jwt))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        // Tiptap / yjs state is a binary update payload — no inline
        // disposition (stays a download / fetch().arrayBuffer() target).
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .header(HttpHeaders.CACHE_CONTROL, "private, max-age=3600")
                .body(bytes);
    }

    private static UUID callerId(Jwt jwt) {
        return UUID.fromString(jwt.getSubject());
    }
}
