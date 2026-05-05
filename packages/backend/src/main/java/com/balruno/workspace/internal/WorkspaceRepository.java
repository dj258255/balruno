// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.workspace.internal;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

interface WorkspaceRepository extends JpaRepository<WorkspaceEntity, UUID> {

    /** Active (soft-delete 제외) slug 조회 — V2 의 partial unique index 와 정합. */
    Optional<WorkspaceEntity> findBySlugAndDeletedAtIsNull(String slug);

    boolean existsBySlugAndDeletedAtIsNull(String slug);
}
