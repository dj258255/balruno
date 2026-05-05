// SPDX-License-Identifier: AGPL-3.0-or-later
// Balruno backend — Gradle Kotlin DSL build script.
//
// Stack: Java 25 (LTS) + Spring Boot 4.0 + virtual threads. ADR 0006 v1.2.
// Phase B-2.1 adds the persistence layer (PG 18 + Flyway + JPA).

plugins {
    java
    id("org.springframework.boot") version "4.0.6"
    id("io.spring.dependency-management") version "1.1.6"
}

group = "com.balruno"
version = "0.0.1-SNAPSHOT"
description = "Balruno backend (AGPL-3.0-or-later)"

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(25)
    }
}

repositories {
    mavenCentral()
}

dependencyManagement {
    imports {
        // Spring Modulith BOM (ADR 0014). Pins all spring-modulith-* artifacts.
        mavenBom("org.springframework.modulith:spring-modulith-bom:1.4.0")
        // Testcontainers BOM — Spring Boot 4 BOM dropped the testcontainers
        // entries that 3.x carried, so we pin the family ourselves.
        mavenBom("org.testcontainers:testcontainers-bom:1.21.3")
    }
}

dependencies {
    // Web stack — embedded Tomcat + Spring MVC + Jackson
    implementation("org.springframework.boot:spring-boot-starter-web")

    // Actuator — /actuator/health for nginx-side liveness probe + Prometheus scrape (B-3)
    implementation("org.springframework.boot:spring-boot-starter-actuator")

    // Persistence — JPA over Hibernate 7 + Hikari pool. Schema is owned by
    // Flyway; JPA is set to ddl-auto=validate so mappings can never silently
    // drift from the DDL. ADR 0001 (PG 18) + ADR 0012 (UUIDv7).
    //
    // Spring Boot 4 split autoconfig into per-feature modules. JPA / Hikari /
    // Hibernate autoconfig comes via starter-data-jpa transitively, but
    // Flyway autoconfig now lives in its own starter — without this starter,
    // flyway-core sits on the classpath but is never invoked at boot.
    implementation("org.springframework.boot:spring-boot-starter-data-jpa")
    implementation("org.springframework.boot:spring-boot-starter-validation")
    implementation("org.springframework.boot:spring-boot-starter-flyway")
    implementation("org.flywaydb:flyway-database-postgresql")
    runtimeOnly("org.postgresql:postgresql")

    // Auth — Spring Security 7 + OAuth2 client (GitHub + Google) + resource
    // server (Bearer JWT validation). starter-security pulls in the
    // SecurityFilterChain autoconfig; oauth2-client adds the login redirect
    // + callback flow; oauth2-resource-server brings nimbus-jose-jwt for
    // self-issued JWT validation. ADR 0002 + 0014.
    implementation("org.springframework.boot:spring-boot-starter-security")
    implementation("org.springframework.boot:spring-boot-starter-oauth2-client")
    implementation("org.springframework.boot:spring-boot-starter-oauth2-resource-server")
    testImplementation("org.springframework.security:spring-security-test")

    // OpenAPI / Swagger UI — springdoc 2.8+ supports Spring Boot 4. Enabled
    // in dev/local profile only; prod disables both api-docs and swagger-ui
    // via application-prod.yml so the schema isn't an attack surface.
    implementation("org.springdoc:springdoc-openapi-starter-webmvc-ui:2.8.13")

    // Spring Modulith — modular monolith with compile-time module boundaries (ADR 0014)
    implementation("org.springframework.modulith:spring-modulith-starter-core")
    testImplementation("org.springframework.modulith:spring-modulith-starter-test")

    // ArchUnit override — Modulith 1.4 BOM pins an older ArchUnit that can't
    // read Java 25 (class file major 69) bytecode. 1.4.2 fixes this.
    testImplementation("com.tngtech.archunit:archunit:1.4.2")

    // Test
    testImplementation("org.springframework.boot:spring-boot-starter-test")
    testImplementation("org.springframework.boot:spring-boot-testcontainers")
    testImplementation("org.testcontainers:postgresql")
    testImplementation("org.testcontainers:junit-jupiter")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

tasks.withType<Test> {
    useJUnitPlatform()
}

tasks.bootJar {
    archiveFileName.set("balruno-backend.jar")
}
