# Balruno 백엔드 아키텍처 (Java + Spring Boot + MySQL)

> **작성**: 2026-04-18
> **위치**: `docs/draft/BACKEND_KO.md` (개인 작업 공간)
> **범위**: 서버 쪽 기술 스택, API, DB 스키마, 온프렘 배포 전체
> **프론트엔드/UX/전략**: [`MASTER_PLAN_KO.md`](./MASTER_PLAN_KO.md) 참조
> **상태**: Day 30 유저 검증 전 **청사진**. 검증 전 대규모 구현 금지.

---

## 목차

1. [스택 선택 이유](#1-스택-선택-이유)
2. [전체 시스템 아키텍처](#2-전체-시스템-아키텍처)
3. [API 설계](#3-api-설계)
4. [데이터베이스 스키마](#4-데이터베이스-스키마)
5. [스냅샷 파이프라인](#5-스냅샷-파이프라인)
6. [시뮬 이벤트 파이프라인](#6-시뮬-이벤트-파이프라인)
7. [성능 전략 (MySQL 특화)](#7-성능-전략-mysql-특화)
8. [인증 / 권한](#8-인증--권한)
9. [온프렘 배포](#9-온프렘-배포)
10. [모니터링 / 로깅](#10-모니터링--로깅)
11. [개발 단계별 구현 순서](#11-개발-단계별-구현-순서)
12. [웹 리서치 출처](#12-웹-리서치-출처)

---

## 1. 스택 선택 이유

### 확정 스택

| 레이어 | 선택 | 버전 |
|---|---|---|
| 언어 | **Java** | 21 LTS |
| 프레임워크 | **Spring Boot** | 3.4.x |
| ORM | Spring Data JPA + Hibernate | 6.x |
| 데이터베이스 | **MySQL** | 8.4+ LTS |
| 캐시 | Redis | 7.x |
| 메시지 큐 (선택) | Redis Streams 또는 RabbitMQ | — |
| 빌드 | Gradle Kotlin DSL | 8.x |
| 배포 | Docker + Docker Compose | — |
| 프록시 | Caddy 또는 Nginx | — |

### 왜 Java + Spring + MySQL (다른 스택 거부 이유)

| vs | 이유 |
|---|---|
| vs Node.js | 한국 엔터프라이즈 표준. 영업 시 "우리 팀 Java 익숙" 반응 유리 |
| vs Rust | 1인 학습 비용 과다. 생태계 대비 불균형 |
| vs PostgreSQL | MySQL이 한국 중소 스튜디오에 더 널리 설치됨. MariaDB 호환성 |
| vs 기존 api-spec.md | 이미 Spring Boot 가정 스펙 있음 — 재활용 가능 |

### 한국 엔터프라이즈 영업 친화 포인트
- Spring Boot = 익숙함 (신뢰)
- MySQL = 내부 DBA 팀이 다룰 수 있음
- Maven/Gradle = 사내 Nexus/Artifactory 호환
- Docker = 기존 내부 쿠버네티스/온프렘 파이프라인 연동

---

## 2. 전체 시스템 아키텍처

```
온프렘 스튜디오 내부망
│
├── [Caddy 또는 Nginx]                    ← TLS, 리버스 프록시
│       │
│       ▼
├── [Frontend]                             ← Next.js 16 standalone
│       │
│       ▼
├── [Spring Boot API] (포트 8080)
│   ├── REST Controller 레이어
│   ├── Service 레이어 (비즈니스 로직)
│   ├── Repository 레이어 (JPA)
│   └── 스케줄러 (@Scheduled)
│       │
│       ├──→ [MySQL 8.4]                   ← 주 데이터
│       │    ├── 편집 레이어 (projects, sheets, cells)
│       │    ├── 스냅샷 레이어 (snapshots, JSON column)
│       │    ├── pre-agg (daily_stats, monthly_stats, yearly_stats)
│       │    └── 시뮬 레이어 (simulation_events)
│       │
│       ├──→ [Redis 7]                     ← 캐시 + Pub/Sub
│       │    ├── today_running_stats (실시간 대시보드)
│       │    ├── session 저장
│       │    └── WebSocket 메시지 브로커
│       │
│       └──→ [MinIO 또는 FS]               ← (선택) 큰 스냅샷 블롭
```

### 프로세스 구성
- `balruno-api`: Spring Boot JAR (2GB 힙 기본)
- `balruno-web`: Next.js standalone
- `db`: MySQL 8
- `redis`: Redis 7
- `caddy`: 프록시
- (선택) `minio`: 블롭 저장

---

## 3. API 설계

### 3.1 엔드포인트 개요

```
인증
  POST   /api/auth/login
  POST   /api/auth/refresh
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

셀 (벌크 지원)
  PATCH  /api/sheets/{id}/cells       # [{rowId, colId, value}, ...]

스냅샷
  POST   /api/snapshots               # 현재 시트를 스냅샷으로 저장
  GET    /api/snapshots?project={id}  # 프로젝트의 스냅샷 목록
  GET    /api/snapshots/{id}          # 스냅샷 상세 (전체 데이터)
  POST   /api/snapshots/{id}/restore  # 스냅샷으로 롤백

통계
  GET    /api/stats/daily?project={id}&column=ATK&from=...&to=...
  GET    /api/stats/monthly?project={id}&column=ATK&year=2026
  GET    /api/stats/yearly?project={id}&column=ATK
  GET    /api/stats/summary?project={id}  # 대시보드 위젯용

시뮬레이션
  POST   /api/simulations/runs        # 새 시뮬 런 시작 (run_id 반환)
  POST   /api/simulations/events      # 이벤트 배치 저장 ([event, ...])
  POST   /api/simulations/runs/{id}/complete
  GET    /api/simulations/runs/{id}   # 시뮬 결과 요약
  GET    /api/simulations/runs        # 최근 시뮬 목록

웹훅
  POST   /api/webhooks/github         # HMAC 서명 검증 후 처리

설정
  GET    /api/config                  # 클라이언트용 설정 (i18n 등)
  GET    /api/health                  # 헬스 체크 (온프렘 운영 필수)
```

### 3.2 응답 공통 형식

성공:
```json
{
  "data": { ... },
  "meta": { "requestId": "...", "timestamp": "..." }
}
```

에러:
```json
{
  "error": {
    "code": "SHEET_NOT_FOUND",
    "message": "해당 시트를 찾을 수 없습니다",
    "details": { ... }
  },
  "meta": { "requestId": "...", "timestamp": "..." }
}
```

### 3.3 인증 (JWT Bearer)

```
Authorization: Bearer <access_token>
```

- Access Token: 1시간 만료, HS256
- Refresh Token: 30일 만료, 데이터베이스 저장
- Access 만료 시 refresh로 재발급

### 3.4 Rate Limiting
- 인증된 유저: 분당 600 요청 (평균 10/초)
- 시뮬 이벤트 POST: 분당 60,000 (배치 때문에 높음)
- 로그인/auth 엔드포인트: 분당 30

구현: Redis 기반 sliding window

---

## 4. 데이터베이스 스키마

### 4.1 사용자 / 권한

```sql
CREATE TABLE users (
  id             CHAR(36) PRIMARY KEY,        -- UUID
  email          VARCHAR(255) NOT NULL UNIQUE,
  password_hash  VARCHAR(255) NOT NULL,       -- BCrypt
  display_name   VARCHAR(100) NOT NULL,
  role           ENUM('admin','member','viewer') DEFAULT 'member',
  created_at     DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at     DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  last_login_at  DATETIME(6),
  
  INDEX idx_users_email (email)
);

CREATE TABLE refresh_tokens (
  id         CHAR(36) PRIMARY KEY,
  user_id    CHAR(36) NOT NULL,
  token_hash VARCHAR(255) NOT NULL,
  expires_at DATETIME(6) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_refresh_tokens_user (user_id)
);
```

### 4.2 편집 레이어

```sql
CREATE TABLE projects (
  id            CHAR(36) PRIMARY KEY,
  name          VARCHAR(200) NOT NULL,
  description   TEXT,
  owner_id      CHAR(36) NOT NULL,
  created_at    DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at    DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  
  FOREIGN KEY (owner_id) REFERENCES users(id),
  INDEX idx_projects_owner (owner_id)
);

CREATE TABLE sheets (
  id             CHAR(36) PRIMARY KEY,
  project_id     CHAR(36) NOT NULL,
  name           VARCHAR(200) NOT NULL,
  columns        JSON NOT NULL,                -- [{id, name, type, formula, ...}, ...]
  export_class_name VARCHAR(100),              -- Unity/Unreal 내보내기용
  created_at     DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at     DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  INDEX idx_sheets_project (project_id)
);

CREATE TABLE rows (
  id         CHAR(36) PRIMARY KEY,
  sheet_id   CHAR(36) NOT NULL,
  row_index  INT NOT NULL,
  cells      JSON NOT NULL,             -- {colId: value, ...}
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  
  FOREIGN KEY (sheet_id) REFERENCES sheets(id) ON DELETE CASCADE,
  UNIQUE KEY uk_sheet_row (sheet_id, row_index),
  INDEX idx_rows_sheet (sheet_id)
);
```

### 4.3 스냅샷 레이어 (파티셔닝)

```sql
CREATE TABLE snapshots (
  id              CHAR(36) NOT NULL,
  project_id      CHAR(36) NOT NULL,
  captured_at     DATETIME(6) NOT NULL,
  captured_date   DATE NOT NULL,             -- 파티셔닝 키
  author_id       CHAR(36),
  git_commit_sha  VARCHAR(64),
  label           VARCHAR(200),
  sheet_data      JSON NOT NULL,              -- 전체 시트 압축 데이터
  checksum        VARCHAR(64) NOT NULL,       -- SHA-256
  size_bytes      BIGINT,
  
  PRIMARY KEY (id, captured_date),            -- 파티션 키 포함 필수
  INDEX idx_snapshots_project_time (project_id, captured_at DESC)
)
PARTITION BY RANGE (TO_DAYS(captured_date)) (
  PARTITION p_2026_q1 VALUES LESS THAN (TO_DAYS('2026-04-01')),
  PARTITION p_2026_q2 VALUES LESS THAN (TO_DAYS('2026-07-01')),
  PARTITION p_2026_q3 VALUES LESS THAN (TO_DAYS('2026-10-01')),
  PARTITION p_2026_q4 VALUES LESS THAN (TO_DAYS('2027-01-01')),
  PARTITION p_future  VALUES LESS THAN (MAXVALUE)
);
```

**장점**: 분기별 파티션으로 오래된 데이터 archive 쉬움. 쿼리 시 파티션 pruning.

### 4.4 Pre-aggregated 통계

```sql
-- 일별 통계
CREATE TABLE daily_stats (
  project_id   CHAR(36) NOT NULL,
  sheet_id     CHAR(36) NOT NULL,
  column_name  VARCHAR(100) NOT NULL,
  day          DATE NOT NULL,
  avg_value    DOUBLE,
  min_value    DOUBLE,
  max_value    DOUBLE,
  stddev       DOUBLE,
  p50          DOUBLE,
  p95          DOUBLE,
  row_count    INT,
  updated_at   DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  
  PRIMARY KEY (project_id, sheet_id, column_name, day),
  INDEX idx_daily_stats_project_day (project_id, day DESC)
)
PARTITION BY RANGE (TO_DAYS(day)) (
  PARTITION p_2026 VALUES LESS THAN (TO_DAYS('2027-01-01')),
  PARTITION p_2027 VALUES LESS THAN (TO_DAYS('2028-01-01')),
  PARTITION p_future VALUES LESS THAN (MAXVALUE)
);

CREATE TABLE monthly_stats (
  project_id   CHAR(36) NOT NULL,
  sheet_id     CHAR(36) NOT NULL,
  column_name  VARCHAR(100) NOT NULL,
  month        DATE NOT NULL,               -- 월 1일
  avg_value    DOUBLE,
  min_value    DOUBLE,
  max_value    DOUBLE,
  stddev       DOUBLE,
  p50          DOUBLE,
  p95          DOUBLE,
  row_count    INT,
  updated_at   DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  
  PRIMARY KEY (project_id, sheet_id, column_name, month)
);

CREATE TABLE yearly_stats (
  project_id   CHAR(36) NOT NULL,
  sheet_id     CHAR(36) NOT NULL,
  column_name  VARCHAR(100) NOT NULL,
  year         SMALLINT NOT NULL,
  avg_value    DOUBLE,
  min_value    DOUBLE,
  max_value    DOUBLE,
  stddev       DOUBLE,
  p50          DOUBLE,
  p95          DOUBLE,
  row_count    INT,
  updated_at   DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  
  PRIMARY KEY (project_id, sheet_id, column_name, year)
);
```

### 4.5 시뮬 레이어

```sql
CREATE TABLE simulation_runs (
  id            CHAR(36) PRIMARY KEY,
  project_id    CHAR(36) NOT NULL,
  snapshot_id   CHAR(36),
  started_by    CHAR(36) NOT NULL,
  started_at    DATETIME(6) NOT NULL,
  ended_at      DATETIME(6),
  status        ENUM('running','completed','failed') NOT NULL,
  config        JSON NOT NULL,         -- 시뮬 파라미터
  summary       JSON,                   -- 집계 결과
  
  INDEX idx_sim_runs_project_time (project_id, started_at DESC),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (started_by) REFERENCES users(id)
);

CREATE TABLE simulation_events (
  id              BIGINT AUTO_INCREMENT NOT NULL,
  run_id          CHAR(36) NOT NULL,
  event_date      DATE NOT NULL,            -- 파티션 키
  event_type      VARCHAR(50) NOT NULL,     -- 'attack', 'crit', 'death', 'heal'
  event_time_ms   INT NOT NULL,
  actor_id        VARCHAR(100),
  target_id       VARCHAR(100),
  damage          DOUBLE,
  is_critical     BOOLEAN DEFAULT FALSE,
  metadata        JSON,
  created_at      DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  
  PRIMARY KEY (id, event_date),
  INDEX idx_sim_events_run (run_id, event_time_ms)
)
PARTITION BY RANGE (TO_DAYS(event_date)) (
  PARTITION p_2026_h1 VALUES LESS THAN (TO_DAYS('2026-07-01')),
  PARTITION p_2026_h2 VALUES LESS THAN (TO_DAYS('2027-01-01')),
  PARTITION p_future  VALUES LESS THAN (MAXVALUE)
);
```

### 4.6 권한 (Phase 2+)

```sql
CREATE TABLE project_members (
  project_id CHAR(36) NOT NULL,
  user_id    CHAR(36) NOT NULL,
  role       ENUM('owner','editor','viewer') NOT NULL,
  added_at   DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  
  PRIMARY KEY (project_id, user_id),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE audit_logs (
  id          BIGINT AUTO_INCREMENT NOT NULL,
  event_date  DATE NOT NULL,
  user_id     CHAR(36),
  project_id  CHAR(36),
  action      VARCHAR(100) NOT NULL,    -- 'sheet.updated', 'snapshot.created' 등
  target_id   VARCHAR(100),
  details     JSON,
  created_at  DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  
  PRIMARY KEY (id, event_date),
  INDEX idx_audit_project_time (project_id, created_at DESC)
)
PARTITION BY RANGE (TO_DAYS(event_date)) (
  PARTITION p_current  VALUES LESS THAN (TO_DAYS('2027-01-01')),
  PARTITION p_future   VALUES LESS THAN (MAXVALUE)
);
```

---

## 5. 스냅샷 파이프라인

### 5.1 생성 흐름

```java
@Service
@RequiredArgsConstructor
public class SnapshotService {
    
    private final SheetRepository sheetRepository;
    private final SnapshotRepository snapshotRepository;
    
    @Transactional
    public Snapshot createSnapshot(UUID projectId, String label, UUID authorId) {
        // 1. 프로젝트의 모든 시트 로드
        List<Sheet> sheets = sheetRepository.findByProjectId(projectId);
        
        // 2. JSON 직렬화 + 체크섬
        String sheetData = objectMapper.writeValueAsString(sheets);
        String checksum = DigestUtils.sha256Hex(sheetData);
        
        // 3. 스냅샷 저장
        Snapshot snapshot = Snapshot.builder()
            .id(UUID.randomUUID())
            .projectId(projectId)
            .capturedAt(OffsetDateTime.now())
            .capturedDate(LocalDate.now())
            .authorId(authorId)
            .label(label)
            .sheetData(sheetData)
            .checksum(checksum)
            .sizeBytes((long) sheetData.length())
            .build();
        
        return snapshotRepository.save(snapshot);
    }
}
```

### 5.2 자동 스냅샷 스케줄링

```java
@Component
@RequiredArgsConstructor
public class SnapshotScheduler {
    
    private final ProjectRepository projectRepository;
    private final SnapshotService snapshotService;
    
    // 매일 자정
    @Scheduled(cron = "0 0 0 * * *")
    public void createDailySnapshots() {
        projectRepository.findActiveProjects().forEach(project -> {
            try {
                snapshotService.createSnapshot(
                    project.getId(),
                    "Daily auto-snapshot",
                    null
                );
            } catch (Exception e) {
                log.error("Failed snapshot for {}", project.getId(), e);
            }
        });
    }
}
```

### 5.3 롤백

```java
@Transactional
public void restoreFromSnapshot(UUID snapshotId) {
    Snapshot snapshot = snapshotRepository.findById(snapshotId)
        .orElseThrow(() -> new NotFoundException("Snapshot not found"));
    
    // 1. 현재 상태를 자동 스냅샷 (안전망)
    createSnapshot(snapshot.getProjectId(), "Before restore", currentUserId);
    
    // 2. 기존 시트 삭제
    sheetRepository.deleteByProjectId(snapshot.getProjectId());
    
    // 3. 스냅샷 데이터로 복원
    List<Sheet> sheets = objectMapper.readValue(
        snapshot.getSheetData(),
        new TypeReference<List<Sheet>>() {}
    );
    sheetRepository.saveAll(sheets);
}
```

---

## 6. 시뮬 이벤트 파이프라인

### 6.1 배치 수신 (성능 중요)

```java
@RestController
@RequestMapping("/api/simulations")
public class SimulationController {
    
    private final SimulationEventService eventService;
    
    // 클라이언트가 최대 1000개 이벤트 배치로 보냄
    @PostMapping("/events")
    public ResponseEntity<Void> recordEvents(
        @RequestBody List<SimulationEventDto> events,
        @AuthenticationPrincipal User user
    ) {
        eventService.saveEventsBatch(events);
        return ResponseEntity.accepted().build();
    }
}
```

### 6.2 벌크 삽입 최적화

```java
@Service
public class SimulationEventService {
    
    private final JdbcTemplate jdbcTemplate;
    
    public void saveEventsBatch(List<SimulationEventDto> events) {
        String sql = """
            INSERT INTO simulation_events 
            (run_id, event_date, event_type, event_time_ms, 
             actor_id, target_id, damage, is_critical, metadata)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """;
        
        jdbcTemplate.batchUpdate(sql, events, 500, (ps, event) -> {
            ps.setString(1, event.getRunId());
            ps.setDate(2, Date.valueOf(LocalDate.now()));
            ps.setString(3, event.getEventType());
            ps.setInt(4, event.getEventTimeMs());
            ps.setString(5, event.getActorId());
            ps.setString(6, event.getTargetId());
            ps.setDouble(7, event.getDamage());
            ps.setBoolean(8, event.isCritical());
            ps.setString(9, objectMapper.writeValueAsString(event.getMetadata()));
        });
    }
}
```

### 6.3 시뮬 완료 시 집계

```java
@Transactional
public SimulationSummary completeRun(UUID runId) {
    // 집계 쿼리로 summary 계산
    String sql = """
        SELECT 
          COUNT(*) as total_events,
          AVG(damage) as avg_damage,
          SUM(CASE WHEN is_critical THEN 1 ELSE 0 END) / COUNT(*) as crit_rate,
          MAX(event_time_ms) / 1000.0 as duration_sec
        FROM simulation_events
        WHERE run_id = ?
        """;
    
    SimulationSummary summary = jdbcTemplate.queryForObject(
        sql, new Object[]{runId}, summaryRowMapper);
    
    // DPS 계산
    double avgDps = summary.getTotalDamage() / summary.getDurationSec();
    summary.setAvgDps(avgDps);
    
    // simulation_runs 업데이트
    simulationRunRepository.updateSummary(runId, summary);
    
    return summary;
}
```

---

## 7. 성능 전략 (MySQL 특화)

### 7.1 MySQL에는 TimescaleDB 없음 — 대안 3가지

#### 대안 1: MySQL Event Scheduler + 수동 집계 ⭐ 추천
```sql
-- MySQL 내장 스케줄러 활성화
SET GLOBAL event_scheduler = ON;

-- 매일 자정 daily_stats 갱신 프로시저
DELIMITER $$
CREATE PROCEDURE refresh_daily_stats(IN p_date DATE)
BEGIN
  INSERT INTO daily_stats (project_id, sheet_id, column_name, day, 
                           avg_value, min_value, max_value, stddev, row_count)
  SELECT 
    p.id as project_id,
    s.id as sheet_id,
    'ATK' as column_name,
    p_date as day,
    AVG(JSON_EXTRACT(r.cells, '$.ATK')) as avg_value,
    MIN(JSON_EXTRACT(r.cells, '$.ATK')) as min_value,
    MAX(JSON_EXTRACT(r.cells, '$.ATK')) as max_value,
    STDDEV(JSON_EXTRACT(r.cells, '$.ATK')) as stddev,
    COUNT(*) as row_count
  FROM projects p
  JOIN sheets s ON s.project_id = p.id
  JOIN rows r ON r.sheet_id = s.id
  WHERE DATE(r.updated_at) = p_date
  GROUP BY p.id, s.id
  ON DUPLICATE KEY UPDATE
    avg_value = VALUES(avg_value),
    min_value = VALUES(min_value),
    max_value = VALUES(max_value),
    stddev = VALUES(stddev),
    row_count = VALUES(row_count);
END$$
DELIMITER ;

-- 매일 자정 실행
CREATE EVENT daily_stats_refresh
ON SCHEDULE EVERY 1 DAY
STARTS TIMESTAMP(CURRENT_DATE + INTERVAL 1 DAY)
DO CALL refresh_daily_stats(CURRENT_DATE - INTERVAL 1 DAY);
```

#### 대안 2: Spring `@Scheduled` 애플리케이션 레벨 집계
- MySQL Event보다 로깅/에러 처리 쉬움
- 멀티 인스턴스 환경에서 중복 실행 방지 필요 (ShedLock)

#### 대안 3: ProxySQL + 캐싱
- 자주 쓰는 집계 쿼리를 ProxySQL 레벨 캐시
- 간단하지만 granular 제어 어려움

**권고**: Phase 1은 **대안 2 (Spring @Scheduled + ShedLock)**.
```xml
<dependency>
    <groupId>net.javacrumbs.shedlock</groupId>
    <artifactId>shedlock-spring</artifactId>
    <version>5.x</version>
</dependency>
```

### 7.2 파티셔닝 전략

모든 시계열 테이블은 날짜 기반 range 파티셔닝:
- `snapshots` — 분기별
- `daily_stats` — 년별
- `simulation_events` — 반기별
- `audit_logs` — 년별

**이점**:
- 쿼리 시 partition pruning (속도 향상)
- 오래된 파티션 DROP (공간 회수)
- 백업 시 파티션별 가능

### 7.3 JSON 컬럼 인덱스

MySQL 8은 JSON 컬럼의 **virtual column + index** 지원:

```sql
ALTER TABLE sheets
  ADD COLUMN export_class_v VARCHAR(100) 
    AS (JSON_UNQUOTE(JSON_EXTRACT(columns, '$[0].exportClassName'))) VIRTUAL,
  ADD INDEX idx_sheets_export_class (export_class_v);
```

### 7.4 커넥션 풀 설정

```yaml
# application.yml
spring:
  datasource:
    hikari:
      maximum-pool-size: 20         # 1인 창업자: 10-20 충분
      minimum-idle: 5
      connection-timeout: 30000
      idle-timeout: 600000
      max-lifetime: 1800000
```

### 7.5 Redis 캐싱 레이어

```java
@Cacheable(value = "dailyStats", key = "#projectId + ':' + #column + ':' + #from + ':' + #to")
public List<DailyStat> getDailyStats(UUID projectId, String column, 
                                      LocalDate from, LocalDate to) {
    return dailyStatsRepository.findBetween(projectId, column, from, to);
}

// 스냅샷 생성 시 캐시 무효화
@CacheEvict(value = "dailyStats", allEntries = true)
public Snapshot createSnapshot(...) { ... }
```

---

## 8. 인증 / 권한

### 8.1 JWT 기반 인증

```java
@Configuration
@EnableWebSecurity
public class SecurityConfig {
    
    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        return http
            .csrf(csrf -> csrf.disable())
            .sessionManagement(s -> s.sessionCreationPolicy(STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/auth/**", "/api/health").permitAll()
                .requestMatchers("/api/webhooks/**").permitAll()  // HMAC 서명 별도 검증
                .anyRequest().authenticated()
            )
            .addFilterBefore(jwtAuthFilter(), UsernamePasswordAuthenticationFilter.class)
            .build();
    }
}
```

### 8.2 역할 기반 접근 제어 (Phase 2+)

```java
@PreAuthorize("hasProjectRole(#projectId, 'editor')")
public void updateSheet(UUID projectId, UUID sheetId, SheetUpdate update) {
    ...
}
```

- `owner`: 모든 권한 + 삭제 + 멤버 관리
- `editor`: 편집 + 스냅샷 생성
- `viewer`: 읽기 전용

### 8.3 Enterprise: SSO (Phase 3+)
- SAML 2.0 via Spring Security SAML
- OIDC via Spring Security OAuth2
- Keycloak 통합 (고객사 AD/LDAP 연동)

---

## 9. 온프렘 배포

### 9.1 Docker 이미지 빌드

```dockerfile
# Dockerfile
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY build/libs/balruno-api.jar app.jar
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -q -O - http://localhost:8080/api/health || exit 1
ENTRYPOINT ["java", "-jar", "app.jar"]
```

### 9.2 Docker Compose (고객 배포용)

```yaml
# docker-compose.yml
version: '3.8'
services:
  web:
    image: balruno/web:${VERSION:-latest}
    depends_on: [api]
    restart: unless-stopped
    
  api:
    image: balruno/api:${VERSION:-latest}
    depends_on: [db, redis]
    environment:
      SPRING_PROFILES_ACTIVE: prod
      SPRING_DATASOURCE_URL: jdbc:mysql://db:3306/balruno?useSSL=true
      SPRING_DATASOURCE_USERNAME: pb
      SPRING_DATASOURCE_PASSWORD: ${DB_PASSWORD}
      SPRING_REDIS_HOST: redis
      JWT_SECRET: ${JWT_SECRET}
      JAVA_OPTS: "-Xmx2g -XX:+UseG1GC"
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "-q", "-O-", "http://localhost:8080/api/health"]
      interval: 30s
    
  db:
    image: mysql:8.4
    environment:
      MYSQL_ROOT_PASSWORD: ${DB_ROOT_PASSWORD}
      MYSQL_DATABASE: balruno
      MYSQL_USER: pb
      MYSQL_PASSWORD: ${DB_PASSWORD}
    volumes:
      - dbdata:/var/lib/mysql
    command:
      - --event-scheduler=ON
      - --max_connections=200
      - --innodb_buffer_pool_size=1G
    restart: unless-stopped
    
  redis:
    image: redis:7-alpine
    volumes:
      - redisdata:/data
    restart: unless-stopped
    
  caddy:
    image: caddy:2
    ports: ['443:443', '80:80']
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddydata:/data
    restart: unless-stopped

volumes:
  dbdata:
  redisdata:
  caddydata:
```

### 9.3 고객 설치 가이드

```markdown
# Balruno 설치 가이드 (온프렘)

## 사전 요구
- Docker Engine 24+
- RAM 최소 4GB (권장 8GB)
- 디스크 50GB+
- HTTPS 도메인 (내부 DNS OK)

## 설치 (5분)

1. 설치 파일 다운로드
   ```
   git clone https://github.com/balruno/onprem
   cd onprem
   ```

2. 환경 변수 설정
   ```
   cp .env.example .env
   # .env 편집:
   # - DB_PASSWORD (강력한 비밀번호)
   # - JWT_SECRET (openssl rand -base64 32)
   # - DOMAIN (예: balruno.internal.company.com)
   ```

3. 실행
   ```
   docker compose up -d
   ```

4. 관리자 계정 생성
   - 브라우저에서 https://<도메인> 접속
   - 첫 접속 시 관리자 계정 생성

## 업데이트
```
docker compose pull
docker compose up -d
```

## 백업
```
docker exec db mysqldump -u pb -p balruno > backup_$(date +%Y%m%d).sql
```

## 폐쇄망 설치
1. 다른 인터넷 가능 환경에서:
   ```
   docker save -o balruno.tar balruno/web:latest balruno/api:latest mysql:8.4 redis:7-alpine caddy:2
   ```
2. USB 등으로 반입
3. 폐쇄망 서버에서:
   ```
   docker load -i balruno.tar
   docker compose up -d
   ```
```

### 9.4 업그레이드 & 롤백

```java
// Flyway 마이그레이션 자동 적용
@Configuration
public class FlywayConfig {
    
    @Bean
    public FlywayMigrationStrategy migrationStrategy() {
        return flyway -> {
            flyway.repair();  // 실패한 마이그레이션 복구
            flyway.migrate();
        };
    }
}
```

마이그레이션 파일: `src/main/resources/db/migration/V1__initial_schema.sql`

---

## 10. 모니터링 / 로깅

### 10.1 헬스 체크

```java
@RestController
public class HealthController {
    
    @GetMapping("/api/health")
    public Map<String, Object> health() {
        return Map.of(
            "status", "UP",
            "timestamp", Instant.now(),
            "version", buildVersion,
            "db", dbHealth(),
            "redis", redisHealth()
        );
    }
}
```

### 10.2 로깅 (온프렘 친화)

```yaml
logging:
  level:
    root: INFO
    com.balruno: DEBUG
  file:
    name: /var/log/balruno/api.log
  pattern:
    file: "%d{yyyy-MM-dd HH:mm:ss.SSS} [%thread] %-5level %logger{36} - %msg%n"
  logback:
    rollingpolicy:
      max-file-size: 100MB
      max-history: 30
```

### 10.3 메트릭 (선택)

Micrometer + Prometheus:
```yaml
management:
  endpoints:
    web:
      exposure:
        include: health,metrics,prometheus
```

고객이 자체 Prometheus/Grafana 있으면 연동.

### 10.4 에러 리포팅

- Sentry 셀프호스티드 버전 지원 권고
- 고객사가 자체 Sentry 운영 중이면 연동

---

## 11. 개발 단계별 구현 순서

### Stage 0: 검증 전 (Day 1-30) — 구현 0
아무것도 만들지 않는다. 프론트엔드 버그 수정과 유저 대화만.

### Stage 1: 백엔드 MVP (Month 2-3, 유저 검증 후)
- Spring Boot 프로젝트 초기화 (Gradle)
- 기본 인증 (JWT, 단일 유저)
- Projects / Sheets / Rows CRUD
- 간단 스냅샷 (자동 갱신 없이 수동만)
- Docker Compose 로컬 실행 가능

**Deliverable**: 1대 서버에서 프론트 + 백 + DB 돌아감

### Stage 2: 스냅샷 통계 (Month 3-4)
- 스냅샷 파티셔닝 적용
- daily_stats / monthly_stats 테이블 + @Scheduled 집계
- /api/stats 엔드포인트
- 프론트 대시보드 위젯

**Deliverable**: "지난 달 평균 DPS" 200ms 이하 응답

### Stage 3: 시뮬 수집 (Month 4-5)
- simulation_runs / simulation_events 테이블
- 배치 삽입 엔드포인트
- 클라이언트 Web Worker에서 이벤트 전송
- 시뮬 결과 집계 API

**Deliverable**: 10만 이벤트 시뮬 → 1초 이내 수집 + 5초 이내 요약

### Stage 4: 멀티 유저 (Month 5-6)
- project_members 테이블 + RBAC
- 감사 로그 (audit_logs)
- 행 댓글 (Phase 2에서만)

**Deliverable**: 한 프로젝트에 3인 공유 가능

### Stage 5: 온프렘 패키징 (Month 6+)
- 고객 배포 가이드 문서
- Docker Compose 최적화 (1 서버 4GB RAM)
- 백업/복구 스크립트
- Flyway 마이그레이션 검증

**Deliverable**: 고객사에 1-클릭 설치 가능

### Stage 6: Enterprise (Phase 3+)
- SSO (SAML/OIDC)
- GitHub/GitLab Webhook 양방향
- 감사 로그 SIEM 연동
- SLA 99.5% 보장

---

## 12. 웹 리서치 출처

### MySQL 시계열 & 파티셔닝
- [MySQL Time Series Data 2026 (OneUptime)](https://oneuptime.com/blog/post/2026-03-31-mysql-use-mysql-for-time-series-data/view)
- [MySQL Spring Data JPA 2026 (OneUptime)](https://oneuptime.com/blog/post/2026-03-31-mysql-spring-data-jpa/view)
- [Aggregate Millions of Rows in Spring (DZone)](https://dzone.com/articles/aggregate-millions-of-database-rows-in-a-spring-co)

### Spring Boot JSON 매핑
- [Map JSON Column with JPA 3 + Hibernate 6 (dev.to)](https://dev.to/antozanini/how-to-map-a-json-column-in-spring-boot-with-jpa-3-and-hibernate-6-5gd5)
- [Persisting JSON with Spring Data (Bootify)](https://bootify.io/docs/persist-json-with-spring-data-hibernate.html)

### CQRS + Event Sourcing + Spring
- [CQRS Event Sourcing Spring Boot 2026 (Medium)](https://medium.com/@karunakunwar899/cqrs-event-sourcing-in-spring-boot-68756af665a8)
- [GitHub: robinhosz/cqrs-eventsourcing-springboot](https://github.com/robinhosz/cqrs-eventsourcing-springboot)
- [Playing with CQRS and Event Sourcing in Spring Boot + Axon](https://blog.nebrass.fr/playing-with-cqrs-and-event-sourcing-in-spring-boot-and-axon/)
- [Microservices.io Event Sourcing Pattern](https://microservices.io/patterns/data/event-sourcing.html)

### Spring Boot Scheduler (분산 락)
- [ShedLock — Distributed Lock for Scheduled Tasks](https://github.com/lukas-krecan/ShedLock)

---

## 13. 실제 구현 전 체크리스트

Day 30 후 백엔드 착수 결정 시 확인:

- [ ] 유저 대화에서 "온프렘 필수" 확인됨
- [ ] 유저 대화에서 "통계 대시보드 원함" 확인됨
- [ ] 유저 대화에서 "전투 시뮬 분석 원함" 확인됨 (선택적)
- [ ] 지불 의사 금액 $15K+/년 이상 응답 2건 이상
- [ ] 최소 1개 디자인 파트너 스튜디오 확보
- [ ] 본인 Java/Spring 학습 시간 확보 (주 10시간 이상)
- [ ] 6개월 수입 0 버틸 저축/본업 확보

체크 못 받으면 **Stage 1 진입 보류**. 프론트엔드 Pro 기능만으로 시작.

---

*이 문서는 Stage 1 진입 시 세부 구현 가이드로 전환된다. 지금은 청사진.*
