// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.workspace.internal;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

interface WorkspaceInviteRepository extends JpaRepository<WorkspaceInviteEntity, UUID> {

    Optional<WorkspaceInviteEntity> findByTokenHash(byte[] tokenHash);

    /** Pending (unaccepted, unrevoked) invites for a workspace. */
    List<WorkspaceInviteEntity> findByWorkspaceIdAndAcceptedAtIsNullAndRevokedAtIsNull(UUID workspaceId);
}
