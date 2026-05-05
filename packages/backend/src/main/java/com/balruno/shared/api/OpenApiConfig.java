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
 * springdoc OpenAPI metadata.
 *
 * - title / version / license
 * - servers (production + local dev)
 * - bearer JWT security scheme
 * - shared {@code ProblemDetail} (RFC 7807) schema so OpenAPI clients see
 *   that every 4xx/5xx response shares the same shape
 *
 * The prod profile disables api-docs and swagger-ui via
 * application-prod.yml, so this bean still loads but no endpoint exposes
 * the schema externally.
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
                                Send the JWT in either:
                                - `Authorization: Bearer <jwt>` header (Electron / API client / CLI), or
                                - `balruno_session` cookie (browser, set automatically after OAuth login).

                                ## Errors
                                Every 4xx/5xx response is `application/problem+json` (RFC 7807).
                                Custom extensions: `code` (app-level error code), `traceId` (echoes
                                X-Request-Id), and `errors` (field-level array on validation failure).

                                ## Versioning
                                The `N` in URL prefix `/api/v{N}` is the **major** version. Minor /
                                patch changes (added fields, new endpoints) keep v1. Breaking changes
                                introduce a new /api/v2 prefix.
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
