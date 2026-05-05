# Balruno Backend

> Spring Boot 4.1 + Java 25 (LTS) + Gradle Kotlin DSL.
> AGPL-3.0-or-later. **MIT 라이센스 frontend 코드 import 절대 금지** (ADR 0006 v1.2).

---

## 아키텍처

**Spring Modulith 기반 modular monolith** (ADR 0014).

```
com.balruno
├── user        — OAuth (GitHub + Google) + JWT (Phase B-2)
├── workspace   — Workspace + members (Phase B-3)
├── project     — Project CRUD + quota (Phase B-3)
├── sync        — /ws/projects/{id} WebSocket + op log (Phase B-4)
├── document    — Hocuspocus collab token + doc binary (Phase B-5)
├── ai          — Anthropic API proxy (Stage 1+)
└── shared      — UUIDv7 wrapper, common DTO
```

각 module 은 `@ApplicationModule` 명시. 다른 module 의 `internal` package 접근 시 빌드 실패 (`ArchitectureTest` 가 매 commit 검증).

Module 간 통신 = Spring `ApplicationEvent` (loose coupling).

## 빌드

JDK 25 가 설치되어 있지 않아도 OK — Gradle toolchain 이 자동 다운로드.

```bash
cd packages/backend
./gradlew bootRun           # 로컬 실행 (localhost:8080)
./gradlew bootJar           # build/libs/balruno-backend.jar 생성
./gradlew test              # JUnit + ArchitectureTest
```

## endpoint (Phase B-1 시점)

| Method | Path | 응답 |
|---|---|---|
| GET | `/` | 서비스 정보 (service/version/phase/now) |
| GET | `/actuator/health` | `{"status":"UP"}` (Spring Boot Actuator) |
| GET | `/actuator/info` | application info (license, repo) |

## 배포

GitHub Actions `backend-deploy.yml` (paths: `packages/backend/**`):

1. setup-java 25 (Eclipse Temurin)
2. `./gradlew bootJar` → `build/libs/balruno-backend.jar`
3. SCP 로 prod_app 머신 (`168.107.47.33`) `/opt/balruno/backend/app.jar.new` 전송
4. SSH `sudo mv app.jar.new app.jar && sudo systemctl restart balruno-backend`

## 라이센스

`AGPL-3.0-or-later`. 모든 `.java`/`.kts` 파일 상단:

```java
// SPDX-License-Identifier: AGPL-3.0-or-later
```

frontend (MIT) ↔ backend (AGPL) 코드 import 금지. 공유 type 은 `packages/shared` (MIT) 에.

## 참조

- ADR 0006 v1.2 — Monorepo + Java 25 + Spring Boot 4.1
- ADR 0014 — Backend architecture (Spring Modulith)
- ADR 0007 v1.3 — 인프라 (prod_app 머신 + nginx 8080 reverse proxy)
- HANDOFF.md — 단일 진입점
