// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.workspace.internal;

import com.balruno.workspace.WorkspaceException;

import java.util.Set;
import java.util.regex.Pattern;

/**
 * Slug 정책 (ADR 0015 §3.6) — 사용자 입력 형식 + 예약어 차단을 한 곳에서.
 * Workspace / project / future namespaces 모두 같은 규칙 사용 예정.
 */
final class SlugRules {

    private SlugRules() {}

    private static final Pattern SLUG_PATTERN = Pattern.compile("^[a-z0-9][a-z0-9-]{2,29}$");

    /**
     * URL prefix 와 충돌하는 path / 일반적인 sensitive 이름. 새 endpoint
     * 추가 시 여기에 같이 add — workspace slug 가 시스템 path 와 겹치면
     * 라우팅 모호.
     */
    private static final Set<String> RESERVED = Set.of(
            "api", "app", "admin", "www", "balruno",
            "auth", "login", "logout", "oauth2", "signup",
            "actuator", "swagger-ui", "v3",
            "static", "assets", "public",
            "i", "w", "u", "p",        // 짧은 path prefix 후보 보존
            "help", "support", "docs", "blog", "status",
            "settings", "billing", "team", "teams"
    );

    static void validate(String slug) {
        if (slug == null || !SLUG_PATTERN.matcher(slug).matches()) {
            throw new WorkspaceException(
                    WorkspaceException.Reason.SLUG_INVALID,
                    "Slug must match [a-z0-9][a-z0-9-]{2,29}.");
        }
        if (RESERVED.contains(slug)) {
            throw new WorkspaceException(
                    WorkspaceException.Reason.SLUG_RESERVED,
                    "This slug is reserved.");
        }
    }
}
