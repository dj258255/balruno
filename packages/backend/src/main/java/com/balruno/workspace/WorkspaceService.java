// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.workspace;

import java.util.List;
import java.util.UUID;

/**
 * Workspace 모듈의 outbound API. 다른 모듈 (controller / 향후 project /
 * sheet) 가 호출 — JPA 직접 X.
 */
public interface WorkspaceService {

    /** 새 workspace 생성. 호출자가 OWNER 로 등록됨. */
    Workspace create(UUID creatorUserId, String slug, String name);

    /** Default workspace 자동 생성용. slug 충돌 회피 suffix 자동. */
    Workspace createDefaultFor(UUID userId, String preferredSlugBase, String name);

    Workspace findById(UUID workspaceId);

    /** soft-deleted 제외 slug 조회. */
    Workspace findBySlug(String slug);

    /** 호출 user 가 멤버인 workspace 들 (모든 role 포함). */
    List<Workspace> listForUser(UUID userId);

    /**
     * 호출 user 의 role 이 minRequired 이상이어야 통과. 부족 시
     * {@link WorkspaceException} (INSUFFICIENT_ROLE / NOT_A_MEMBER).
     */
    void requireRole(UUID workspaceId, UUID userId, WorkspaceRole minRequired);
}
