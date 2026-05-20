// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.shared.api;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Pins the {@link ApiExceptionHandler#handleResponseStatus} behavior —
 * controller-thrown 4xx must surface verbatim, not collapse to a
 * synthetic 500 via the catch-all. Regression guard for the bug where
 * {@code POST /api/v1/auth/collab-token} 404s were leaking out as
 * {@code code=INTERNAL_ERROR / status=500}.
 */
class ApiExceptionHandlerTest {

    private final ApiExceptionHandler handler = new ApiExceptionHandler();

    @Test
    void notFoundPassesThroughVerbatim() {
        var pd = handler.handleResponseStatus(
                new ResponseStatusException(HttpStatus.NOT_FOUND));

        assertThat(pd.getStatus()).isEqualTo(404);
        assertThat(pd.getTitle()).isEqualTo("Not Found");
        assertThat(pd.getProperties()).containsEntry("code", "NOT_FOUND");
    }

    @Test
    void payloadTooLargeKeeps413AndCarriesReasonAsDetail() {
        var pd = handler.handleResponseStatus(
                new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE,
                        "attachment may not exceed 50 MB"));

        assertThat(pd.getStatus()).isEqualTo(413);
        assertThat(pd.getProperties()).containsEntry("code", "PAYLOAD_TOO_LARGE");
        assertThat(pd.getDetail()).isEqualTo("attachment may not exceed 50 MB");
    }

    @Test
    void unsupportedMediaTypeKeeps415() {
        var pd = handler.handleResponseStatus(
                new ResponseStatusException(HttpStatus.UNSUPPORTED_MEDIA_TYPE,
                        "avatar bytes do not match the declared image type"));

        assertThat(pd.getStatus()).isEqualTo(415);
        assertThat(pd.getProperties()).containsEntry("code", "UNSUPPORTED_MEDIA_TYPE");
    }

    /**
     * Regression guard for the second 404 → 500 leak: Spring's
     * {@code NoResourceFoundException} (raised on requests to paths
     * with no controller, e.g. {@code GET /} or {@code GET /v3/api-docs})
     * is an {@code ErrorResponseException}, not a {@code ResponseStatusException},
     * so it slipped through {@code handleResponseStatus} and got
     * collapsed to {@code INTERNAL_ERROR / 500} by the catch-all. The
     * dedicated handler must surface a 404.
     */
    @Test
    void noResourceFoundSurfacesAs404() {
        // NoResourceFoundException(HttpMethod, requestPath, resourcePath) —
        // Spring 6.2+ signature. The third arg is the original resource
        // path that the static-resource handler failed to resolve.
        var pd = handler.handleNoResource(
                new NoResourceFoundException(org.springframework.http.HttpMethod.GET, "/", "/"));

        assertThat(pd.getStatus()).isEqualTo(404);
        assertThat(pd.getTitle()).isEqualTo("Not Found");
        assertThat(pd.getProperties()).containsEntry("code", "NOT_FOUND");
    }
}
