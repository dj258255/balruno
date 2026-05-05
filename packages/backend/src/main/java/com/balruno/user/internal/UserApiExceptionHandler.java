// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.user.internal;

import com.balruno.user.UserAuthException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.NoSuchElementException;

/**
 * Global exception → ProblemDetail (RFC 7807) translator for the user
 * module's HTTP API. Browser-redirect flows (OAuth callback) handle their
 * own errors in {@link OAuth2LoginSuccessHandler}; everything reaching
 * {@code /api/**} routes through here.
 *
 * Logging policy:
 *   - 4xx: WARN with the cause but no stack trace — not actionable on our side.
 *   - 5xx: ERROR with full stack + a traceId field on the response so
 *     a user-reported error maps cleanly to a single log line.
 */
@RestControllerAdvice
class UserApiExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(UserApiExceptionHandler.class);

    @ExceptionHandler(UserAuthException.class)
    ProblemDetail handleUserAuth(UserAuthException e) {
        log.warn("user_auth_refused reason={} msg={}", e.reason(), e.getMessage());
        var pd = ProblemDetail.forStatusAndDetail(HttpStatus.UNAUTHORIZED, e.getMessage());
        pd.setTitle("Authentication refused");
        pd.setProperty("code", e.reason().name());
        return pd;
    }

    @ExceptionHandler(NoSuchElementException.class)
    ProblemDetail handleNotFound(NoSuchElementException e) {
        log.warn("not_found msg={}", e.getMessage());
        var pd = ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, "Resource not found.");
        pd.setTitle("Not found");
        pd.setProperty("code", "NOT_FOUND");
        return pd;
    }

    @ExceptionHandler(Exception.class)
    ProblemDetail handleAny(Exception e) {
        var traceId = MDC.get("traceId");
        log.error("unhandled traceId={} type={}", traceId, e.getClass().getName(), e);
        var pd = ProblemDetail.forStatusAndDetail(
                HttpStatus.INTERNAL_SERVER_ERROR,
                "An unexpected error occurred.");
        pd.setTitle("Server error");
        pd.setProperty("code", "INTERNAL_ERROR");
        if (traceId != null) {
            pd.setProperty("traceId", traceId);
        }
        return pd;
    }
}
