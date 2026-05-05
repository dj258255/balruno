// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.user.internal;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * springdoc OpenAPI metadata + the bearer-token security scheme. Only
 * loaded when springdoc autoconfig is active — production switches both
 * api-docs and swagger-ui off via application-prod.yml.
 */
@Configuration
class OpenApiConfig {

    @Bean
    OpenAPI balrunoOpenAPI() {
        return new OpenAPI()
                .info(new Info()
                        .title("Balruno API")
                        .version("v1")
                        .description("Game balancing workspace — backend API.\n\n"
                                + "Authentication: send the self-issued JWT either in the\n"
                                + "balruno_session cookie (set after OAuth login) or in the\n"
                                + "Authorization: Bearer header.")
                        .license(new License().name("AGPL-3.0-or-later")
                                .url("https://www.gnu.org/licenses/agpl-3.0.html")))
                .components(new Components()
                        .addSecuritySchemes("bearerAuth", new SecurityScheme()
                                .type(SecurityScheme.Type.HTTP)
                                .scheme("bearer")
                                .bearerFormat("JWT")));
    }
}
