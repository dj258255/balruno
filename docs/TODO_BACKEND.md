# Balruno 백엔드 할 일

> **상위 문서**: [TODO.md](./TODO.md)
> **동반 문서**: [TODO_FRONTEND.md](./TODO_FRONTEND.md)
> **최종 업데이트**: 2026-04-18 (백엔드 확정 진행으로 업데이트)
> **원칙**: 시간 견적 없음. 기술 의존성만 추적.
> **상태**: **확정 진행**. 모든 Track active. 프론트 Track 0 (Yjs) 와 독립적으로 BE-1 부터 즉시 착수 가능.

---

## 0. 접속 포인트 (프론트 Track 0 Yjs 와 어떻게 만나는가)

프론트가 Y.Doc 을 진실의 소스로 쓰므로 백엔드 역할:

### 로컬 모드 (기본, 오프라인 가능)
- 서버 없이 프론트가 `y-indexeddb` 로 완결 동작
- 유저가 원하지 않으면 서버와 절대 sync 안 함

### 클라우드 모드 (유저가 로그인 시)
- Y.Doc ↔ 서버 sync via `y-websocket` (BE-6)
- 서버는 Y.Doc 업데이트 바이너리를 저장/중계 (BE-6)
- 스냅샷/통계/시뮬은 별도 REST API (BE-2~4)

### 하이브리드
- 로컬 기본, `SettingsModal` Sync 탭에서 언제든 토글
- 오프라인 시 Y.Doc 편집 계속 → 온라인 복귀 시 자동 sync (Yjs CRDT 가 충돌 자동 해결)

이 구조로 Open Core 3단 가격 지원:
- **무료** — 로컬만 (오픈소스, MIT)
- **Pro** — 클라우드 백업 + AI 토큰 한도
- **Team** — 공유/협업/권한
- **Enterprise** — 온프렘 설치

---

## 1. 스택

| 레이어 | 선택 | 버전 |
|--------|------|------|
| 언어 | **Java** | 21 LTS |
| 프레임워크 | **Spring Boot** | 3.4.x |
| ORM | Spring Data JPA + Hibernate | 6.x |
| DB | **MySQL** | 8.4+ LTS |
| 캐시 | Redis | 7.x |
| 메시지 큐 (선택) | Redis Streams / RabbitMQ | — |
| 빌드 | Gradle Kotlin DSL | 8.x |
| 배포 | Docker + Docker Compose | — |
| 프록시 | Caddy / Nginx | — |

### 선택 이유
| vs | 사유 |
|----|------|
| vs Node.js | 한국 엔터프라이즈 표준. 영업 시 "팀 Java 익숙" 유리 |
| vs Rust | 1인 학습 비용 과다 |
| vs PostgreSQL | MySQL 이 한국 중소 스튜디오에 더 널리 설치. MariaDB 호환 |
| vs 새 스펙 | 기존 `docs/api-spec.md` 가 Spring Boot 가정 |

---

## 2. 3-layer 아키텍처

```
Caddy/Nginx  →  Next.js  →  Spring Boot API (8080)
                                │
                                ├──→ MySQL 8.4
                                │    ├─ [L1] 편집 레이어 (projects, sheets, cells)
                                │    ├─ [L2] 스냅샷 레이어 (snapshots JSON + 파티셔닝)
                                │    ├─ [L2] Pre-agg (daily/monthly/yearly_stats)
                                │    ├─ [L3] 시뮬 레이어 (simulation_events 파티셔닝)
                                │    └─ [공통] auth, permissions
                                │
                                ├──→ Redis 7 (캐시 + Pub/Sub)
                                │    ├─ today_running_stats (실시간)
                                │    ├─ session
                                │    └─ WebSocket 메시지 브로커
                                │
                                └──→ (선택) MinIO (큰 블롭, attachment)
```

### 왜 3-layer?
- 편집 변경 → 스냅샷 이벤트 → pre-agg 업데이트
- 통계 조회는 pre-agg 테이블에서 즉시
- 시뮬은 별도 파이프라인 (대용량 이벤트)

---

## 3. 트랙 종속성

```
Track 1 (Auth + 기본 CRUD) ──┬── Track 2 (스냅샷 레이어)
                              │      │
                              │      └── Track 3 (Pre-agg 통계)
                              │
                              ├── Track 4 (시뮬 이벤트 파이프라인)
                              │      ← 스냅샷 ID 참조 (Track 2)
                              │
                              ├── Track 5 (권한 + 공유)
                              │      ← 기본 CRUD (Track 1)
                              │
                              ├── Track 6 (실시간 Yjs WebSocket)
                              │      ← 기본 CRUD (Track 1)
                              │
                              ├── Track 7 (온프렘 패키징)
                              │      ← 모든 트랙 완료
                              │
                              └── Track 8 (모니터링)
                                     ← 독립, 언제든
```

---

## Track 1. Auth + 기본 CRUD

### 목표
프론트엔드에서 "클라우드 모드" 토글 시 서버로 프로젝트 저장/로드.

### 엔드포인트
```
인증
  POST   /api/auth/register       (신규)
  POST   /api/auth/login          (JWT 발급)
  POST   /api/auth/refresh        (Access token 갱신)
  POST   /api/auth/logout
  GET    /api/auth/me

프로젝트
  GET    /api/projects
  POST   /api/projects
  GET    /api/projects/{id}
  PATCH  /api/projects/{id}
  DELETE /api/projects/{id}

시트
  GET    /api/projects/{pid}/sheets
  POST   /api/projects/{pid}/sheets
  GET    /api/sheets/{id}
  PATCH  /api/sheets/{id}
  DELETE /api/sheets/{id}

셀 (bulk)
  POST   /api/sheets/{id}/cells/bulk   (여러 셀 동시 업데이트)
  PATCH  /api/sheets/{id}/rows/{rid}/cells/{cid}
```

### DB 스키마
```sql
CREATE TABLE users (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE projects (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  owner_id BIGINT NOT NULL,
  description TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  INDEX idx_owner (owner_id)
);

CREATE TABLE sheets (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  project_id BIGINT NOT NULL,
  name VARCHAR(255),
  columns JSON NOT NULL,     -- Column[] 직렬화
  rows JSON NOT NULL,        -- Row[] 직렬화
  stickers JSON,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  INDEX idx_project (project_id)
);
```

### 체크리스트
- [ ] Spring Boot 프로젝트 초기화 (Gradle)
- [ ] `application.yml` dev/prod 분리
- [ ] Flyway DB 마이그레이션
- [ ] JWT 구현 (jjwt 라이브러리)
- [ ] Spring Security 설정
- [ ] users / projects / sheets 엔티티 + JPA
- [ ] CRUD 컨트롤러 + 서비스
- [ ] DTO 매핑 (프론트 타입과 동일 구조)
- [ ] 통합 테스트 (Testcontainers + MySQL)
- [ ] Docker Compose: api + db + caddy + redis

---

## Track 2. 스냅샷 레이어

### 목표
프로젝트 상태를 특정 시점으로 immutable 저장. 롤백/비교/통계 기반.

### 엔드포인트
```
POST   /api/projects/{pid}/snapshots     (수동 스냅샷 생성)
GET    /api/projects/{pid}/snapshots     (타임라인 목록)
GET    /api/snapshots/{id}                (특정 스냅샷 조회)
POST   /api/snapshots/{id}/rollback       (현재 상태로 복원)
GET    /api/snapshots/{id}/diff/{id2}     (두 스냅샷 비교)
```

### DB 스키마
```sql
CREATE TABLE snapshots (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  project_id BIGINT NOT NULL,
  data JSON NOT NULL,         -- 전체 프로젝트 복사
  note VARCHAR(500),          -- 수동 스냅샷 메모
  triggered_by ENUM('manual', 'scheduled', 'commit'),
  created_at TIMESTAMP NOT NULL,
  INDEX idx_project_time (project_id, created_at)
)
PARTITION BY RANGE (YEAR(created_at) * 100 + MONTH(created_at)) (
  PARTITION p202604 VALUES LESS THAN (202605),
  -- 월별 파티션 자동 추가
);
```

### 스냅샷 생성 트리거
1. **수동** — 사용자 버튼 클릭
2. **@Scheduled** — 매일 자정 자동
3. **Commit 이벤트** — 주요 변경 시 (옵션)

### 체크리스트
- [ ] Snapshot 엔티티 + 파티션 설정
- [ ] 수동/스케줄/자동 트리거 구현
- [ ] @Scheduled 매일 자정 태스크
- [ ] 롤백 로직 (현재 sheets 를 과거 버전으로 덮어쓰기)
- [ ] Diff 알고리즘 (JSON 차이 감지 — RFC 6902 JSON Patch)
- [ ] 프론트 "스냅샷 타임라인" UI 연결
- [ ] 오래된 파티션 아카이브 (MinIO로 이동)

---

## Track 3. Pre-aggregated 통계

### 목표
"지난 달 평균 DPS" 같은 집계 쿼리 응답 < 500ms.

### DB 스키마
```sql
CREATE TABLE daily_stats (
  project_id BIGINT,
  stat_date DATE,
  stat_key VARCHAR(100),      -- "avg_dps", "max_ehp", "total_characters" 등
  stat_value DOUBLE,
  sample_size INT,
  PRIMARY KEY (project_id, stat_date, stat_key),
  INDEX idx_key_time (stat_key, stat_date)
);

CREATE TABLE monthly_stats (
  project_id BIGINT,
  year_month VARCHAR(7),       -- "2026-04"
  stat_key VARCHAR(100),
  stat_value DOUBLE,
  sample_size INT,
  PRIMARY KEY (project_id, year_month, stat_key)
);

CREATE TABLE yearly_stats (
  project_id BIGINT,
  stat_year INT,
  stat_key VARCHAR(100),
  stat_value DOUBLE,
  sample_size INT,
  PRIMARY KEY (project_id, stat_year, stat_key)
);
```

### 집계 엔진 선택
MySQL 엔 TimescaleDB 없음 → 대안:

#### 대안 1: MySQL Event Scheduler + 수동 집계 (⭐ 추천)
- DB 자체 스케줄러가 매일 00:10 실행
- 복잡한 트리거 로직 앱 레벨보다 DB 레벨이 빠름

#### 대안 2: Spring @Scheduled 애플리케이션 레벨
- 로직 관리 쉬움 (Java 코드)
- DB 부하 예측 용이

#### 대안 3: ProxySQL + 캐싱
- 대규모 시에만 고려

### 엔드포인트
```
GET /api/projects/{pid}/stats/daily?from=&to=&key=
GET /api/projects/{pid}/stats/monthly?from=&to=&key=
GET /api/projects/{pid}/stats/yearly?from=&to=&key=
GET /api/projects/{pid}/stats/today            (Redis 실시간)
```

### 체크리스트
- [ ] 3개 stats 테이블
- [ ] @Scheduled 일/월/년 집계 태스크
- [ ] Redis `today_running_stats` 실시간 업데이트 (TTL 60초)
- [ ] 통계 API 컨트롤러
- [ ] 프론트 "통계 대시보드" UI 연결
- [ ] 커스텀 stat_key 정의 (유저가 "avg_dps_character_tier_3" 같은 키 정의 가능)

---

## Track 4. 시뮬 이벤트 파이프라인

### 목표
Monte Carlo 시뮬 결과를 서버에 저장 → 큰 규모 통계 + 타임라인.

### DB 스키마
```sql
CREATE TABLE simulation_runs (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  snapshot_id BIGINT NOT NULL,       -- 어느 시점 데이터로 돌렸는가
  config JSON,                        -- 시뮬 설정
  status ENUM('running', 'done', 'failed'),
  started_at TIMESTAMP,
  finished_at TIMESTAMP,
  INDEX idx_snapshot (snapshot_id)
);

CREATE TABLE simulation_events (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  run_id BIGINT NOT NULL,
  event_type VARCHAR(50),             -- "hit", "crit", "kill", "death" 등
  payload JSON,
  created_at TIMESTAMP,
  INDEX idx_run (run_id)
)
PARTITION BY RANGE (YEAR(created_at) * 100 + MONTH(created_at)) (
  -- 월별 파티션 (대량)
);

CREATE TABLE simulation_stats (
  run_id BIGINT PRIMARY KEY,
  total_events BIGINT,
  win_rate DOUBLE,
  avg_ttk DOUBLE,
  histogram JSON,                     -- 분포 데이터
  computed_at TIMESTAMP
);
```

### 엔드포인트
```
POST   /api/simulations                       (시뮬 실행 시작)
POST   /api/simulations/{id}/events/bulk      (배치 이벤트 업로드, 프론트가 Monte Carlo 결과 전송)
GET    /api/simulations/{id}                  (상태 조회)
GET    /api/simulations/{id}/summary          (집계 결과)
GET    /api/simulations/{id}/events?page=     (이벤트 타임라인)
```

### 성능 최적화
- 벌크 삽입 (JDBC batch, 1000 rows/tx)
- 파티션 pruning
- 완료 시 집계 → `simulation_stats` 에 저장 → 이후 조회는 여기서

### 체크리스트
- [ ] 3개 시뮬 테이블
- [ ] 벌크 insert API (속도 중요)
- [ ] 완료 시 집계 @Scheduled or 트리거
- [ ] 이벤트 타임라인 페이지네이션
- [ ] 프론트 "시뮬 대시보드" UI 연결
- [ ] 오래된 이벤트 아카이브 (MinIO)

---

## Track 5. 권한 + 공유

### DB 스키마
```sql
CREATE TABLE project_members (
  project_id BIGINT,
  user_id BIGINT,
  role ENUM('viewer', 'commenter', 'editor', 'admin'),
  added_at TIMESTAMP,
  PRIMARY KEY (project_id, user_id)
);

CREATE TABLE share_links (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  project_id BIGINT,
  token VARCHAR(64) UNIQUE,      -- URL 해시
  role ENUM('viewer', 'commenter', 'editor'),
  expires_at TIMESTAMP NULL,      -- NULL = 무기한
  password_hash VARCHAR(255),    -- 옵션 (비밀번호 보호)
  created_by BIGINT,
  INDEX idx_token (token)
);
```

### 엔드포인트
```
GET    /api/projects/{pid}/members
POST   /api/projects/{pid}/members          (이메일 초대)
PATCH  /api/projects/{pid}/members/{uid}
DELETE /api/projects/{pid}/members/{uid}

POST   /api/projects/{pid}/share-links      (공유 링크 생성)
GET    /api/projects/{pid}/share-links
DELETE /api/share-links/{id}

GET    /api/share/{token}                   (공유 링크로 접근)
```

### 권한 체크 (Spring)
```java
@PreAuthorize("@projectSecurity.canEdit(#projectId, principal)")
public Sheet updateSheet(@PathVariable Long projectId, ...) { ... }
```

### 체크리스트
- [ ] project_members / share_links 테이블
- [ ] Role-based 권한 체크 메소드
- [ ] 초대 이메일 발송 (SMTP or SendGrid)
- [ ] 공유 링크 토큰 생성 (crypto-secure random)
- [ ] 비밀번호 보호 링크
- [ ] 만료 관리 (@Scheduled 정리)
- [ ] 프론트 권한 UI (SettingsModal 확장)

---

## Track 6. 실시간 (Yjs WebSocket)

### 전제
프론트 Track 8 Stage C (WebSocket 요구). Stage B (WebRTC) 까지는 백엔드 없이 가능.

### 구조
```
Browser A                              Browser B
   │                                      │
   │  WebSocket                WebSocket  │
   ▼                                      ▼
      ┌──────────────────────────────┐
      │  Spring Boot WS Handler       │
      │  (y-websocket 프로토콜)      │
      └──────────┬───────────────────┘
                 │
                 ▼
           [Redis Pub/Sub]
                 │
                 ▼
           [MySQL Persistence]
           snapshots 또는 yjs_updates
```

### DB 스키마 (Yjs 업데이트 저장)
```sql
CREATE TABLE yjs_updates (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  doc_id VARCHAR(255),         -- 프로젝트 ID
  update_data BLOB,            -- Yjs 바이너리 업데이트
  client_id BIGINT,
  created_at TIMESTAMP,
  INDEX idx_doc (doc_id, created_at)
);
```

### 엔드포인트
```
WS /api/yjs/{projectId}          (WebSocket 연결)
GET /api/yjs/{projectId}/sync    (초기 sync 데이터)
```

### 체크리스트
- [ ] y-websocket 프로토콜 Java 구현 (참고: yjs/y-protocols)
- [ ] WebSocket 인증 (JWT 쿼리 파라미터)
- [ ] Redis Pub/Sub 으로 다중 서버 브로드캐스트
- [ ] yjs_updates 주기적 compaction (10000개 쌓이면 snapshot)
- [ ] 프론트 `y-websocket` provider 와 연결

---

## Track 7. 온프렘 패키징

### 목표
스튜디오가 내부망에 설치 가능.

### Docker Compose
```yaml
services:
  web:
    image: balruno/web:${VERSION}
    environment:
      - API_URL=http://api:8080
    depends_on: [api]

  api:
    image: balruno/api:${VERSION}
    environment:
      - SPRING_DATASOURCE_URL=jdbc:mysql://db:3306/balruno
      - REDIS_HOST=redis
      - JWT_SECRET=${JWT_SECRET}
    depends_on: [db, redis]

  db:
    image: mysql:8.4
    environment:
      - MYSQL_DATABASE=balruno
      - MYSQL_USER=${DB_USER}
      - MYSQL_PASSWORD=${DB_PASSWORD}

  redis:
    image: redis:7-alpine

  caddy:
    image: caddy:2
    ports: ["80:80", "443:443"]
```

### 설치 스크립트
```bash
git clone https://github.com/balruno/onprem
cd onprem
cp .env.example .env
# .env 편집: DOMAIN, MYSQL_PASSWORD, JWT_SECRET
docker compose up -d
```

### 오프라인 설치 (인터넷 없는 내부망)
```bash
# 인터넷 있는 곳에서:
docker save -o balruno.tar \
  balruno/web:latest balruno/api:latest \
  mysql:8.4 redis:7-alpine caddy:2

# 내부망에서:
docker load -i balruno.tar
docker compose up -d
```

### 백업 / 복원
```bash
# 매일 새벽 3시 cron
docker exec db mysqldump -u root -p balruno > backup_$(date +%Y%m%d).sql
# S3 or MinIO 업로드
```

### 체크리스트
- [ ] Docker 이미지 (web / api 멀티스테이지 빌드)
- [ ] docker-compose.yml 프로덕션 템플릿
- [ ] `.env.example` + 설치 가이드 (한국어)
- [ ] 오프라인 번들 스크립트
- [ ] 백업/복원 스크립트
- [ ] 업데이트 마이그레이션 절차 (Flyway)
- [ ] 설치 문서 + 스크린샷

---

## Track 8. 모니터링 / 로깅

### Prometheus + Grafana
- Spring Boot Actuator `/actuator/prometheus`
- 메트릭: 응답 시간 p95/p99, 에러율, DB 쿼리 시간, JVM heap

### 로그
```yaml
logging:
  level:
    root: INFO
    com.balruno: DEBUG
  file:
    name: /var/log/balruno/api.log
```

### 알람
- 에러율 > 1% → Slack/Email
- 디스크 사용 > 80% → Email
- 스냅샷 집계 실패 → 즉시 Email
- DB 연결 풀 고갈 → Slack

### 체크리스트
- [ ] Spring Boot Actuator 설정
- [ ] Prometheus config (scrape 엔드포인트)
- [ ] Grafana 대시보드 (JSON 템플릿)
- [ ] Alertmanager 룰
- [ ] 로그 로테이션 (logback)
- [ ] Sentry (옵션) — 예외 추적

---

## 4. 성능 전략 (MySQL 특화)

### 파티셔닝
- `snapshots`, `simulation_events` → 월별 파티션
- 오래된 파티션 아카이브 (MinIO)

### JSON 컬럼 인덱스
- MySQL 8.4 `JSON_EXTRACT` + 가상 컬럼 인덱스
- 자주 조회 key (`$.columns[*].name`) 미리 인덱싱

### 커넥션 풀
```yaml
spring:
  datasource:
    hikari:
      maximum-pool-size: 20
      minimum-idle: 5
      connection-timeout: 30000
```

### Redis 캐싱
- hot path 쿼리 결과 캐싱
- 세션 저장
- WebSocket pub/sub

---

## 5. 마이그레이션 — 프론트 로컬 → 서버

현재 프론트는 IndexedDB 로컬. 서버 도입 시:

### 시나리오
1. 유저가 `SettingsModal` Cloud Sync 탭에서 "클라우드 모드 전환"
2. 서버 URL + 로그인
3. 프론트가 IndexedDB → 서버 bulk POST (모든 프로젝트)
4. `authStore.serverUrl` 설정 → 이후 모든 액션 서버
5. IndexedDB 는 오프라인 캐시

### 하위호환
- 서버 모드 ON/OFF 토글 가능
- 오프라인 시 IndexedDB 저장 → 재연결 시 sync

### 프론트 작업
- `lib/sync/` 재구현 (Track 8 Yjs Stage C)
- `authStore` 실제 사용

---

## 6. 비용 추정 (온프렘, 참고)

| 항목 | 월 |
|------|-----|
| 하드웨어 감가상각 | ~$30 |
| 전기 | ~$20 |
| 관리자 5% FTE | ~$500 |
| **합계** | **~$550/월** |

### 가격 정책 (시나리오 A)
- Self-hosted: $15K/yr (일시불) — 초기 구매 + 연간 업데이트
- Managed: $3K/월 — Balruno 호스팅
- 대기업: Custom (SLA, 전담 지원)

---

## 7. 관련 문서

- **[TODO.md](./TODO.md)** — 상위 전체 계획
- **[TODO_FRONTEND.md](./TODO_FRONTEND.md)** — 프론트 Track 1~11
- **[api-spec.md](./api-spec.md)** — API 상세 스펙 (Track 1에서 업데이트)
- **archive/BACKEND_KO.md** — 백엔드 구 설계 문서 (1,086줄 상세판)
- **archive/B2B_PLAYBOOK_KO.md** — 세일즈/POC/계약서 (Track 7 이후)
