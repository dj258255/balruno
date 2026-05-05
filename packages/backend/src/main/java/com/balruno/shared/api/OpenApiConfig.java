// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.shared.api;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import io.swagger.v3.oas.models.media.IntegerSchema;
import io.swagger.v3.oas.models.media.ObjectSchema;
import io.swagger.v3.oas.models.media.Schema;
import io.swagger.v3.oas.models.media.StringSchema;
import io.swagger.v3.oas.models.security.SecurityScheme;
import io.swagger.v3.oas.models.servers.Server;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.List;

/**
 * springdoc OpenAPI 메타데이터.
 *
 * - title / version / license
 * - servers (production + local dev)
 * - bearer JWT security scheme
 * - {@code ProblemDetail} (RFC 7807) 공통 schema 노출 — 모든 4xx/5xx 응답이
 *   같은 shape 라는 걸 OpenAPI 클라이언트 generator 에 알림
 *
 * prod profile 은 application-prod.yml 에서 api-docs / swagger-ui 둘 다
 * disable — 이 bean 자체는 부팅하지만 endpoint 노출 X.
 */
@Configuration
class OpenApiConfig {

    @Bean
    OpenAPI balrunoOpenAPI() {
        return new OpenAPI()
                .info(new Info()
                        .title("Balruno API")
                        .version("v1")
                        .description(
                                """
                                Game balancing workspace — backend API.

                                ## Authentication
                                JWT 를 둘 중 한 곳으로 전송:
                                - `Authorization: Bearer <jwt>` header (Electron / API client / CLI)
                                - `balruno_session` cookie (브라우저, OAuth login 후 자동 set)

                                ## Errors
                                모든 4xx/5xx 응답은 RFC 7807 `application/problem+json`.
                                custom extension: `code` (앱 레벨 코드), `traceId` (X-Request-Id),
                                `errors` (validation 실패 시 field 목록).

                                ## Versioning
                                URL prefix `/api/v{N}` 의 N 은 **major 버전**. minor / patch 변경
                                (필드 추가, 새 endpoint) 은 v1 유지. breaking change 시 v2 신규 prefix.
                                """)
                        .license(new License()
                                .name("AGPL-3.0-or-later")
                                .url("https://www.gnu.org/licenses/agpl-3.0.html")))
                .servers(List.of(
                        new Server().url("https://api.balruno.com").description("Production"),
                        new Server().url("http://localhost:8080").description("Local dev")))
                .components(new Components()
                        .addSecuritySchemes("bearerAuth", new SecurityScheme()
                                .type(SecurityScheme.Type.HTTP)
                                .scheme("bearer")
                                .bearerFormat("JWT"))
                        .addSchemas("ProblemDetail", problemDetailSchema()));
    }

    private Schema<?> problemDetailSchema() {
        return new ObjectSchema()
                .description("RFC 7807 Problem Details for HTTP APIs (with Balruno extensions).")
                .addProperty("type", new StringSchema()
                        .example("about:blank")
                        .description("URI identifier for the problem type."))
                .addProperty("title", new StringSchema()
                        .example("Validation failed")
                        .description("Short, human-readable summary."))
                .addProperty("status", new IntegerSchema()
                        .example(400)
                        .description("HTTP status code."))
                .addProperty("detail", new StringSchema()
                        .description("Human-readable explanation specific to this occurrence."))
                .addProperty("instance", new StringSchema()
                        .description("URI reference for the specific problem occurrence."))
                .addProperty("code", new StringSchema()
                        .example("VALIDATION_FAILED")
                        .description("Application-level enum-like code (Balruno extension)."))
                .addProperty("traceId", new StringSchema()
                        .example("019df91d-9174-7f56-a829-4efcfc09465e")
                        .description("X-Request-Id of the failing request (Balruno extension)."))
                .addProperty("errors", new ObjectSchema()
                        .description("Field-level errors when code=VALIDATION_FAILED (Balruno extension)."));
    }
}
