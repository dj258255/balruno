// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.shared.api;

import com.balruno.user.UserAuthException;
import com.balruno.workspace.WorkspaceException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Map;
import java.util.NoSuchElementException;

/**
 * App-wide RFC 7807 exception → ProblemDetail mapper. Handles both
 * domain exceptions (UserAuthException / WorkspaceException) and the
 * standard Spring Web ones (validation, malformed body, missing params,
 * access denied) plus the catch-all fallback. Each handler decides the
 * HTTP status; domain modules just throw and stay agnostic of the HTTP
 * surface.
 *
 * Logging policy:
 *   - 4xx : WARN (caller-side fault, no operator action needed)
 *   - 5xx : ERROR with full stack (operator action needed)
 */
@RestControllerAdvice
class ApiExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(ApiExceptionHandler.class);

    // ── Domain exceptions ──────────────────────────────────────────────

    @ExceptionHandler(UserAuthException.class)
    ProblemDetail handleUserAuth(UserAuthException e) {
        log.warn("user_auth_refused reason={} msg={}", e.reason(), e.getMessage());
        return ProblemDetails.of(HttpStatus.UNAUTHORIZED,
                "Authentication refused",
                e.reason().name(),
                e.getMessage());
    }

    @ExceptionHandler(WorkspaceException.class)
    ProblemDetail handleWorkspace(WorkspaceException e) {
        log.warn("workspace_error reason={} msg={}", e.reason(), e.getMessage());
        var status = mapWorkspace(e.reason());
        return ProblemDetails.of(status,
                "Workspace request failed",
                e.reason().name(),
                e.getMessage());
    }

    private static HttpStatus mapWorkspace(WorkspaceException.Reason reason) {
        return switch (reason) {
            case SLUG_TAKEN, CANNOT_REMOVE_OWNER, INVITE_ALREADY_USED -> HttpStatus.CONFLICT;
            case SLUG_RESERVED, SLUG_INVALID -> HttpStatus.BAD_REQUEST;
            case WORKSPACE_NOT_FOUND -> HttpStatus.NOT_FOUND;
            case NOT_A_MEMBER, INSUFFICIENT_ROLE, OWNER_REQUIRED -> HttpStatus.FORBIDDEN;
            case INVITE_EXPIRED, INVITE_REVOKED -> HttpStatus.GONE;
        };
    }

    // ── Spring Web standard exceptions ─────────────────────────────────

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ProblemDetail handleValidation(MethodArgumentNotValidException e) {
        var fields = e.getBindingResult().getFieldErrors().stream()
                .map(fe -> Map.<String, Object>of(
                        "field", fe.getField(),
                        "message", fe.getDefaultMessage() == null ? "invalid" : fe.getDefaultMessage()))
                .toList();
        log.warn("validation_failed fields={}",
                fields.stream().map(m -> m.get("field")).toList());
        var pd = ProblemDetails.of(HttpStatus.BAD_REQUEST,
                "Validation failed",
                "VALIDATION_FAILED",
                "One or more fields failed validation.");
        pd.setProperty("errors", fields);
        return pd;
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    ProblemDetail handleNotReadable(HttpMessageNotReadableException e) {
        log.warn("malformed_body msg={}", e.getMostSpecificCause().getMessage());
        return ProblemDetails.of(HttpStatus.BAD_REQUEST,
                "Malformed request body",
                "MALFORMED_BODY",
                "The request body could not be parsed.");
    }

    @ExceptionHandler(MissingServletRequestParameterException.class)
    ProblemDetail handleMissingParam(MissingServletRequestParameterException e) {
        log.warn("missing_parameter param={}", e.getParameterName());
        var pd = ProblemDetails.of(HttpStatus.BAD_REQUEST,
                "Missing required parameter",
                "MISSING_PARAMETER",
                "Required parameter '" + e.getParameterName() + "' is missing.");
        pd.setProperty("parameter", e.getParameterName());
        return pd;
    }

    @ExceptionHandler(AccessDeniedException.class)
    ProblemDetail handleAccessDenied(AccessDeniedException e) {
        log.warn("access_denied msg={}", e.getMessage());
        return ProblemDetails.of(HttpStatus.FORBIDDEN,
                "Access denied",
                "FORBIDDEN",
                "You do not have permission to access this resource.");
    }

    // ── Resource lookup ────────────────────────────────────────────────

    @ExceptionHandler(NoSuchElementException.class)
    ProblemDetail handleNotFound(NoSuchElementException e) {
        log.warn("not_found msg={}", e.getMessage());
        return ProblemDetails.of(HttpStatus.NOT_FOUND,
                "Not found",
                "NOT_FOUND",
                e.getMessage() == null ? "Resource not found." : e.getMessage());
    }

    // ── Fallback ───────────────────────────────────────────────────────

    @ExceptionHandler(Exception.class)
    ProblemDetail handleAny(Exception e) {
        log.error("unhandled type={}", e.getClass().getName(), e);
        return ProblemDetails.of(HttpStatus.INTERNAL_SERVER_ERROR,
                "Server error",
                "INTERNAL_ERROR",
                "An unexpected error occurred. Use the X-Request-Id / traceId to report this.");
    }
}
