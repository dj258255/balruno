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
 * Tags every request with a unique id. Trusts an inbound X-Request-Id
 * header when present (e.g. propagated from nginx / Cloudflare / a client
 * SDK), otherwise mints a fresh UUIDv4. The id lands in the SLF4J MDC
 * under {@code traceId} so every log line carries it (the LogstashEncoder
 * in logback-spring.xml has {@code includeMdcKeyName traceId}), and is
 * echoed back to the client in the same header.
 *
 * Runs at HIGHEST_PRECEDENCE so the SecurityFilterChain — and its
 * authentication-failure responses — can already see the trace id.
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
