// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

/**
 * Spins up an ephemeral PostgreSQL container per test class and wires its
 * URL/credentials into Spring's environment via @ServiceConnection. The
 * test profile uses the same Flyway migrations as production, so any DDL
 * regression breaks tests before the deploy pipeline ever sees it.
 */
@TestConfiguration(proxyBeanMethods = false)
class TestcontainersConfig {

    @Bean
    @ServiceConnection
    PostgreSQLContainer<?> postgresContainer() {
        return new PostgreSQLContainer<>(DockerImageName.parse("postgres:18"));
    }
}
