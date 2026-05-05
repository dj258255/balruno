// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.workspace;

/**
 * Workspace 멤버 role. Baserow 의 5-tier 를 hybrid 도메인 (시트+문서) 에
 * 맞춰 의미 일반화 — Builder 는 "구조 변경" (시트 schema / 시트 트리 /
 * 문서 트리 / project), Editor 는 "내용 편집" (시트 셀 / 문서 본문).
 *
 * 순서대로 강한 권한 → 약한 권한. {@code permits(target)} 으로 "이 role
 * 이 target role 이상의 권한을 갖는가" 비교 가능.
 *
 * String 값은 V2 의 PG ENUM {@code workspace_role} 과 일치 — 추가 시 ENUM
 * ADD VALUE migration + 이 enum 에 새 상수.
 *
 * 자세한 매트릭스 + 거부된 후보: ADR 0015 §3.2.
 */
public enum WorkspaceRole {
    OWNER,
    ADMIN,
    BUILDER,
    EDITOR,
    VIEWER;

    /**
     * 이 role 이 {@code target} 의 책임 이상을 가진다 (즉, 더 강하거나 같다).
     * OWNER.permits(EDITOR) == true.
     */
    public boolean permits(WorkspaceRole target) {
        return this.ordinal() <= target.ordinal();
    }
}
