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

import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;

/**
 * App-level RFC 7807 exception → ProblemDetail mapper. 모든 도메인 예외 +
 * Spring 의 표준 web 예외 (Validation / NotReadable / AccessDenied / 기본
 * Exception fallback) 를 한 곳에서 응답 형태 통일.
 *
 * 모듈별 exception (UserAuthException / WorkspaceException) 도 여기서 함께
 * 처리 — 도메인 모듈은 *던지기* 만 하고 HTTP status 매핑은 shared 책임.
 *
 * Logging 정책:
 *   - 4xx : WARN (사용자 입력 / 권한 문제, 운영자 조치 불필요)
 *   - 5xx : ERROR + full stack (운영자 조치 필요)
 */
@RestControllerAdvice
class ApiExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(ApiExceptionHandler.class);

    // ── 도메인 예외 ────────────────────────────────────────────────────

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

    // ── Spring web 표준 ────────────────────────────────────────────────

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

    /** Helper preserved for tests / future reflection. */
    @SuppressWarnings("unused")
    private static List<String> ___unused() { return List.of(); }
}
