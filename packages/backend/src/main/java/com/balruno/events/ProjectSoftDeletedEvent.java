// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.events;

import java.util.UUID;

/**
 * Fired when a project is soft-deleted. Storage module listens to
 * cascade-delete the project's attachments from R2 / LocalFs and
 * decrement the workspace's storage counter.
 *
 * Publishers (project module) emit on TransactionSynchronization
 * afterCommit — a rolled-back soft-delete must not cascade-delete
 * blob bytes that the original transaction expected to keep.
 */
public record ProjectSoftDeletedEvent(
        UUID projectId,
        UUID workspaceId
) {}
