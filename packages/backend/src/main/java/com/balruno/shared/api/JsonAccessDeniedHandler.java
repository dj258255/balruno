// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.shared.api;

import tools.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;

/**
 * Same idea as {@link JsonAuthenticationEntryPoint} but for the
 * authenticated-but-forbidden case (Spring Security raises this when an
 * access decision rejects an authenticated principal). Emits an RFC 7807
 * 403 instead of the default empty body.
 */
@Component
class JsonAccessDeniedHandler implements AccessDeniedHandler {

    private final ObjectMapper objectMapper;

    JsonAccessDeniedHandler(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Override
    public void handle(HttpServletRequest request, HttpServletResponse response,
                       AccessDeniedException accessDeniedException) throws IOException {
        var pd = ProblemDetails.of(HttpStatus.FORBIDDEN,
                "Access denied",
                "FORBIDDEN",
                "You do not have permission to access this resource.");
        response.setStatus(HttpStatus.FORBIDDEN.value());
        response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
        objectMapper.writeValue(response.getOutputStream(), pd);
    }
}
