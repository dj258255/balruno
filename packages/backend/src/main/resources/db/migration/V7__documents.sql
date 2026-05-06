-- SPDX-License-Identifier: AGPL-3.0-or-later
-- V7 — documents (yjs binary 저장 — Hocuspocus 컨테이너가 read/write).
--
-- Owner: 본 마이그레이션은 schema 만 정의한다. 실제 read/write 는
-- packages/collab 의 Hocuspocus 서버가 자체 hooks (onLoadDocument /
-- onStoreDocument) 로 직접 SQL 사용. Spring backend 에 JPA entity 매핑은
-- 두지 않으며 (Hibernate ddl-auto=validate 가 entity 없는 테이블은 무시),
-- backend 와 collab 의 결합은 cascade delete (FK ON DELETE CASCADE) 만이다.
--
-- 본 schema 결정은 ADR 0017 §2.5 (V6/V7 분리) 그대로. V6 (sync 영역
-- 컬럼 + op_idempotency) 는 Stage B 와 함께 추가.

CREATE TABLE documents (
    id          UUID            PRIMARY KEY DEFAULT uuidv7(),
    project_id  UUID            NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    slug        VARCHAR(50)     NOT NULL,
    title       TEXT            NOT NULL,
    binary      BYTEA           NOT NULL,
    deleted_at  TIMESTAMPTZ,
    created_at  TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ     NOT NULL DEFAULT now(),
    UNIQUE (project_id, slug)
);

-- "List active documents in a project" 가 hot path (사이드바 트리, 검색).
-- soft-delete 30일 후 hard-delete 는 별도 cron (ADR 0015 §6 Q4).
CREATE INDEX documents_project_active_idx
    ON documents (project_id) WHERE deleted_at IS NULL;
