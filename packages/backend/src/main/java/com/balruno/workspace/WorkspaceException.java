// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.workspace;

/**
 * Workspace 도메인 비즈니스 예외. 401 / 403 / 404 / 409 매핑은
 * UserApiExceptionHandler 가 reason 으로 분기.
 */
public class WorkspaceException extends RuntimeException {

    public enum Reason {
        SLUG_TAKEN,            // 409 — 사용자 입력 slug 충돌
        SLUG_RESERVED,         // 400 — api/app/admin 등 예약어
        SLUG_INVALID,          // 400 — 정규식 불일치
        WORKSPACE_NOT_FOUND,   // 404
        NOT_A_MEMBER,          // 403 — 해당 user 가 멤버 아님
        INSUFFICIENT_ROLE,     // 403 — role 부족
        OWNER_REQUIRED,        // 403 — Owner 만 가능한 작업
        CANNOT_REMOVE_OWNER,   // 409 — 마지막 Owner 제거 시도
        INVITE_EXPIRED,        // 410
        INVITE_ALREADY_USED,   // 409
        INVITE_REVOKED         // 410
    }

    private final Reason reason;

    public WorkspaceException(Reason reason, String message) {
        super(message);
        this.reason = reason;
    }

    public Reason reason() {
        return reason;
    }
}
