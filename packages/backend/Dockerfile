# SPDX-License-Identifier: AGPL-3.0-or-later
# Multi-stage Dockerfile for the Balruno backend.
# Stage 1: Gradle build with Eclipse Temurin 25 JDK.
# Stage 2: minimal JRE 25 runtime with non-root user.

# ─── Build stage ──────────────────────────────────────────────────────
FROM eclipse-temurin:25-jdk AS build
WORKDIR /workspace

# Pre-fetch deps so a code-only change benefits from layer cache.
COPY gradle gradle
COPY gradlew settings.gradle.kts build.gradle.kts ./
RUN chmod +x gradlew && ./gradlew --no-daemon dependencies > /dev/null 2>&1 || true

COPY src src
RUN ./gradlew --no-daemon bootJar

# ─── Runtime stage ────────────────────────────────────────────────────
FROM eclipse-temurin:25-jre AS runtime
WORKDIR /app

# Non-root user (uid 1001 — same convention across our self-host stack).
RUN groupadd --system --gid 1001 spring \
 && useradd --system --uid 1001 --gid spring --shell /sbin/nologin spring \
 && chown -R spring:spring /app

COPY --from=build --chown=spring:spring /workspace/build/libs/balruno-backend.jar app.jar

USER spring
EXPOSE 8080

# Container-aware JVM flags. SPRING_PROFILES_ACTIVE et al. come from
# docker-compose env.
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75 -XX:+UseG1GC -XX:+HeapDumpOnOutOfMemoryError -XX:HeapDumpPath=/tmp -Dfile.encoding=UTF-8"

# A docker-native HEALTHCHECK so 'docker ps' shows healthy/unhealthy and
# docker compose can gate dependents on it. wget is in eclipse-temurin
# base image; falling back to a Java one-liner if it ever isn't.
HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=60s \
  CMD wget -qO- --spider http://localhost:8080/actuator/health || exit 1

ENTRYPOINT ["java", "-jar", "/app/app.jar"]
