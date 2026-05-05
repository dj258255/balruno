// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.workspace.internal;

import com.balruno.workspace.WorkspaceRole;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

interface WorkspaceMemberRepository extends JpaRepository<
        WorkspaceMemberEntity, WorkspaceMemberEntity.WorkspaceMemberId> {

    Optional<WorkspaceMemberEntity> findByWorkspaceIdAndUserId(UUID workspaceId, UUID userId);

    List<WorkspaceMemberEntity> findByUserId(UUID userId);

    List<WorkspaceMemberEntity> findByWorkspaceId(UUID workspaceId);

    long countByWorkspaceIdAndRole(UUID workspaceId, WorkspaceRole role);
}
