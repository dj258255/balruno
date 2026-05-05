// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.shared.api;

import tools.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.stereotype.Component;

import java.io.IOException;

/**
 * Replaces Spring Security's default empty-body 401 with an RFC 7807
 * application/problem+json body (Stripe / Linear pattern). The empty
 * default is fine for browser-driven flows but unhelpful for our /api/**
 * clients (Electron, CLI, future mobile) which expect JSON.
 */
@Component
class JsonAuthenticationEntryPoint implements AuthenticationEntryPoint {

    private final ObjectMapper objectMapper;

    JsonAuthenticationEntryPoint(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Override
    public void commence(HttpServletRequest request, HttpServletResponse response,
                         AuthenticationException authException) throws IOException {
        var pd = ProblemDetails.of(HttpStatus.UNAUTHORIZED,
                "Authentication required",
                "UNAUTHENTICATED",
                "Provide a valid JWT in the Authorization header or balruno_session cookie.");
        response.setStatus(HttpStatus.UNAUTHORIZED.value());
        response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
        response.setHeader(HttpHeaders.WWW_AUTHENTICATE, "Bearer");
        objectMapper.writeValue(response.getOutputStream(), pd);
    }
}
