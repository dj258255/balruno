// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.share;

import com.fasterxml.jackson.databind.JsonNode;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Public surface of the share-link module (ADR 0027).
 *
 * Authoring endpoints (create / list / revoke) are scoped to project
 * members. The public read endpoint takes only a token and is
 * unauthenticated — anyone holding the token sees the project as it
 * stands now (read-only, no edit ops).
 */
public interface ShareService {

    /**
     * Create a new share link. The caller must be a member of the
     * project. activeView and sheetId are optional pins; null means
     * "no pin" (recipient sees the live project / sheet state).
     */
    ShareLink create(UUID callerUserId, CreateRequest req);

    /** List active + revoked links inside a project, newest first. */
    List<ShareLink> listForProject(UUID callerUserId, UUID projectId);

    /**
     * Revoke a link. Sets revoked_at = now() so subsequent reads via
     * the token return 404. Idempotent — calling twice on the same
     * id is fine.
     */
    void revoke(UUID callerUserId, UUID linkId);

    /**
     * Public read. No JWT — the only credential is the token. Returns
     * a project snapshot (id + name + sheets) plus the share-link
     * metadata. Throws when the token is unknown, revoked, or expired.
     *
     * Implementations bump {@code last_used_at} best-effort on every
     * call (single UPDATE without retry — the diagnostic is not load-
     * bearing).
     */
    PublicReadResult read(UUID token, OffsetDateTime now);

    record CreateRequest(
            UUID projectId,
            UUID sheetId,
            String activeView,
            OffsetDateTime expiresAt
    ) {}

    /**
     * Returned by the public read endpoint. {@code projectSnapshot}
     * carries the same shape as the WebSocket sync.full payload —
     * id, name, sheets array (each with rows + columns) — so the
     * public viewer can reuse the SheetTable / view components
     * unchanged.
     */
    record PublicReadResult(
            ShareLink link,
            JsonNode projectSnapshot
    ) {}
}
