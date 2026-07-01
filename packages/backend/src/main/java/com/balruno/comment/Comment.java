// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.comment;

import com.fasterxml.jackson.databind.JsonNode;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Public DTO — comment record exposed by the comment module's
 * service / controller. Internal entity mapping lives in
 * {@code comment.internal}.
 *
 * scope_kind drives which anchor fields are populated:
 *   - SHEET_CELL: sheetId + rowId + columnId
 *
 * parentId is NULL for thread roots, set for replies.
 */
public record Comment(
        UUID id,
        UUID projectId,
        ScopeKind scopeKind,
        UUID sheetId,
        UUID rowId,
        UUID columnId,
        UUID parentId,
        UUID authorUserId,
        JsonNode bodyJson,
        boolean resolved,
        UUID resolvedBy,
        OffsetDateTime resolvedAt,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
) {
    public enum ScopeKind { SHEET_CELL }
}
