# Balruno Backend

> Spring Boot 4.0.6 + Java 25 (LTS) + PostgreSQL 18 + Hibernate 7 + Gradle Kotlin DSL.
> Deployed on OCI ($0 free tier, ARM 12GB ×2 + x86 1GB ×2).
> AGPL-3.0-or-later. **MIT 라이센스 frontend 코드 import 절대 금지** (ADR 0006 v1.2).

---

## 아키텍처

**Spring Modulith 기반 modular monolith** (ADR 0014).

```
com.balruno
├── user        — OAuth (GitHub + Google) + JWT
├── workspace   — Workspace + members + role-based access
├── project     — Project CRUD + quota + template import (ADR 0020)
├── sync        — /ws/projects/{id} WebSocket + op log + tree ops (ADR 0008/0017/0018)
├── document    — Hocuspocus collab token + doc binary FK
├── comment     — comments + mentions (ADR 0024) — 5번째 region, op log 없음
├── ai          — (계획) Spring AI 본진 module — BYOK + 5 provider abstraction (ADR 0023 stage 1)
├── ml          — (계획) 통계 ML — outlier / cluster / curve fit / TrueSkill / embedding (ADR 0025)
└── shared      — UUIDv7 wrapper, common DTO
```

각 module 은 `@ApplicationModule` 명시. 다른 module 의 `internal` package 접근 시 빌드 실패 (`ArchitectureTest` 가 매 commit 검증).

Module 간 통신 = Spring `ApplicationEvent` (loose coupling) + cross-module public interface (ProjectSyncApi 등).

## 빌드 / 로컬 실행

### Docker (권장)

```bash
cd packages/backend
docker compose up --build       # localhost:8080 으로 노출, build → 즉시 실행
docker compose down             # 종료
```

### Gradle 직접 (개발 디버깅)

JDK 25 가 설치되어 있지 않아도 OK — Gradle toolchain 이 자동 다운로드.

```bash
./gradlew bootRun               # 로컬 실행 (localhost:8080)
./gradlew bootJar               # build/libs/balruno-backend.jar 생성
./gradlew test                  # JUnit + ArchitectureTest
```

## 주요 endpoint (2026-05-08 기준)

| Method | Path | 설명 |
|---|---|---|
| GET | `/actuator/health` | `{"status":"UP"}` |
| POST | `/api/v1/oauth/{github,google}/callback` | OAuth 콜백 |
| GET | `/api/v1/me` | 현재 user (JWT 인증) |
| GET / POST | `/api/v1/workspaces` | workspace CRUD |
| GET / POST | `/api/v1/workspaces/{id}/projects` | project CRUD |
| WSS | `/ws/projects/{id}` | sheet/tree op log + presence broadcast |
| WSS | `/collab/{docId}` | Hocuspocus yjs sync (collab service) |
| GET / POST / PATCH / DELETE | `/api/v1/comments`, `/api/v1/projects/{id}/comments` | 코멘트 CRUD (ADR 0024) |
| GET | `/api/v1/me/inbox` | 받은 mention 목록 |

## 배포

GitHub Actions `backend-deploy.yml` (paths: `packages/backend/**`):

1. ansible-deploy 가 prod_app 에 Docker engine + `/opt/balruno/backend/docker-compose.yml` 깔린 상태인지 wait
2. Buildx + QEMU (linux/arm64 cross build) → `ghcr.io/dj258255/balruno-backend:latest` + `:<commit-sha>` push
3. SSH prod_app: `docker login ghcr.io && docker compose pull && docker compose up -d`
4. Smoke test `https://api.balruno.com/actuator/health → 200`

배포 단위 = OCI image (multi-stage Dockerfile). Stage 4+ K8s/ECS 마이그레이션 시 같은 image 재사용.

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
