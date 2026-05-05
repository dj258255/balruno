// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.shared.api;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.UUID;

/**
 * 모든 요청에 고유 ID 부여. 들어오는 X-Request-Id 헤더가 있으면 신뢰하고
 * (예: nginx / Cloudflare / 클라이언트 측 propagation), 없으면 UUIDv4 새로
 * 발급. MDC 의 {@code traceId} 키로 모든 log line 에 자동 박힘 (logback-spring.xml
 * 의 LogstashEncoder includeMdcKeyName 설정 활성).
 *
 * SecurityFilterChain 보다 먼저 실행되어야 인증 실패 응답에도 traceId 포함됨.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
class RequestIdFilter extends OncePerRequestFilter {

    static final String HEADER = "X-Request-Id";
    static final String MDC_KEY = "traceId";

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {
        var incoming = req.getHeader(HEADER);
        var id = (incoming == null || incoming.isBlank()) ? UUID.randomUUID().toString() : incoming;
        MDC.put(MDC_KEY, id);
        res.setHeader(HEADER, id);
        try {
            chain.doFilter(req, res);
        } finally {
            MDC.remove(MDC_KEY);
        }
    }
}
