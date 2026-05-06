-- SPDX-License-Identifier: AGPL-3.0-or-later
-- V8 — sync phase Stage B: 3 영역 통합 sync 의 데이터 모델.
--
-- ADR 0008 v2.0 §4 그대로. projects 테이블에 3 영역 (시트 셀 + 시트 트리 +
-- 문서 트리) 의 JSONB 컬럼 + version 컬럼 추가. 4번째 영역 (문서 본문) 은
-- V7 의 documents 테이블 + Hocuspocus 컨테이너 (별도 패턴 B).
--
-- op_idempotency = ADR 0008 §3.3 의 재연결 시 같은 clientMsgId 재전송에 대한
-- cached 응답. ADR 0016 retention 매트릭스 정합 (7일 retention, ADR 0008 §Q2).
--
-- ENUM op_scope_kind 는 UPPERCASE — workspace_role / oauth_provider 와
-- 일관. PG ENUM 은 ADD VALUE 가능 / REMOVE 불가, 미래 영역 (presence?
-- comments?) 추가 가능성 고려해 enum 으로.

-- ─── projects: 3 영역 sync 컬럼 ────────────────────────────────────────
-- data       = 시트 셀 데이터 (sheets[].rows[].cells[]) — Baserow class JSONB blob.
-- sheet_tree = 시트 트리 (folder/sheet 노드 트리) — Outline JSONB tree 패턴.
-- doc_tree   = 문서 트리 — 동일 패턴.
-- *_version  = 영역별 op log version (BIGINT, monotonic ↑). cell event WS 의
--              baseVersion 비교에 사용.
ALTER TABLE projects
    ADD COLUMN data               JSONB    NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN data_version       BIGINT   NOT NULL DEFAULT 1,
    ADD COLUMN sheet_tree         JSONB    NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN sheet_tree_version BIGINT   NOT NULL DEFAULT 1,
    ADD COLUMN doc_tree           JSONB    NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN doc_tree_version   BIGINT   NOT NULL DEFAULT 1;

-- GIN with jsonb_path_ops — 우리 검색 패턴은 containment (`@>`) 위주라
-- jsonb_ops (default) 보다 path_ops 가 인덱스 크기 / build cost 둘 다 작음.
CREATE INDEX projects_data_gin       ON projects USING GIN (data       jsonb_path_ops);
CREATE INDEX projects_sheet_tree_gin ON projects USING GIN (sheet_tree jsonb_path_ops);
CREATE INDEX projects_doc_tree_gin   ON projects USING GIN (doc_tree   jsonb_path_ops);

-- ─── op_scope_kind ENUM ───────────────────────────────────────────────
-- 4 영역 중 op log 패턴을 쓰는 3 영역만. 문서 본문은 yjs binary (V7 documents
-- 테이블) 라 이 ENUM 에 없음.
CREATE TYPE op_scope_kind AS ENUM ('SHEET_CELL', 'SHEET_TREE', 'DOC_TREE');

-- ─── op_idempotency ───────────────────────────────────────────────────
-- 클라가 재연결 후 같은 clientMsgId 재전송 시 cached result 응답
-- ({type:'op.acked', version}). 7일 retention cron (별도 phase) 이 오래된
-- row 정리.
CREATE TABLE op_idempotency (
    client_msg_id   UUID            PRIMARY KEY,
    user_id         UUID            NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    scope_kind      op_scope_kind   NOT NULL,
    scope_id        UUID            NOT NULL,
    result_version  BIGINT          NOT NULL,
    result_payload  JSONB,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT now()
);

-- "이 영역의 최근 op 리스트" — replay / debugging 용. 실시간 hot path 는 PK lookup.
CREATE INDEX op_idempotency_scope_idx   ON op_idempotency (scope_kind, scope_id, created_at DESC);
-- "7일 지난 row 삭제" cron 의 hot path.
CREATE INDEX op_idempotency_created_idx ON op_idempotency (created_at);
