// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.shared.api;

import com.fasterxml.jackson.databind.ObjectMapper;
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
 * Filter chain 에서 인증 실패 시 (Spring Security 의 default 는 빈 body)
 * 우리는 RFC 7807 ProblemDetail JSON 으로 응답. Stripe / Linear 패턴과 정합.
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
