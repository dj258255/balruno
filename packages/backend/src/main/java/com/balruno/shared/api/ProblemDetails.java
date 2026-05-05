// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.shared.api;

import org.slf4j.MDC;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ProblemDetail;

/**
 * Common ProblemDetail builder — fills in title / code / traceId in the
 * shape every Balruno error response should have. The {@code code} and
 * {@code traceId} fields are RFC 7807 §3 extensions (free-form), used as
 * the project-wide convention for app-level error code + request trace.
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
