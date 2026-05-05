// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.workspace.internal;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

interface WorkspaceRepository extends JpaRepository<WorkspaceEntity, UUID> {

    /** Active (non-soft-deleted) slug lookup — matches V2's partial unique index. */
    Optional<WorkspaceEntity> findBySlugAndDeletedAtIsNull(String slug);

    boolean existsBySlugAndDeletedAtIsNull(String slug);
}
