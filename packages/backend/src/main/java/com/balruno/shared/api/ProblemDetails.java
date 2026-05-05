// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.shared.api;

import org.slf4j.MDC;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ProblemDetail;

/**
 * Common ProblemDetail builder — title / code / traceId 표준 채움.
 * RFC 7807 §3 의 extension 필드 (code / traceId / errors) 우리 도메인 컨벤션.
 */
final class ProblemDetails {

    private ProblemDetails() {}

    static ProblemDetail of(HttpStatusCode status, String title, String code, String detail) {
        var pd = ProblemDetail.forStatus(status);
        pd.setTitle(title);
        if (detail != null) {
            pd.setDetail(detail);
        }
        pd.setProperty("code", code);
        var traceId = MDC.get(RequestIdFilter.MDC_KEY);
        if (traceId != null) {
            pd.setProperty("traceId", traceId);
        }
        return pd;
    }
}
