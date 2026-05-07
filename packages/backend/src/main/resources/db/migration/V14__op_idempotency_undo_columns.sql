-- SPDX-License-Identifier: AGPL-3.0-or-later
-- V14 — ADR 0021 v2.3 Phase 5: server-backed undo/redo (Pattern C, Baserow).
--
-- 기존 op_idempotency 테이블을 *재활용*. V8 에서 wire-level 멱등성 캐시로 만들었고
-- 이미 user_id + scope + created_at 다 있음. 추가로 inverse_payload + 시간 윈도우만
-- 더하면 server-backed undo 의 데이터 모델 완성.
--
-- Baserow 의 정확한 디폴트 (master 검증):
--   MINUTES_UNTIL_ACTION_CLEANED_UP = 120         (Cmd+Z 윈도우, 모든 tier 동일)
--   OLD_ACTION_CLEANUP_INTERVAL_MINUTES = 5       (cleanup cron 주기)
--   MAX_UNDOABLE_ACTIONS_PER_ACTION_GROUP = 20    (한 그룹 max action)
--   ClientUndoRedoActionGroupId HTTP header       (per-tab 스코프, client-driven)
--
-- 우리도 Baserow 정확히 (ADR 0021 v2.3 §4 결정 ratio).

-- ─── op_idempotency 확장 ──────────────────────────────────────────────
ALTER TABLE op_idempotency
    -- forward op 시퀀스 (JSONB array). 사용자가 *한번에* 일으킨 op 의 모음 —
    -- 단일 op 면 길이 1, link 양방향 column add 같은 cascade 면 길이 2+.
    -- redo 시점에 이 array 그대로 다시 apply.
    -- frontend UndoEntry.forward (UndoableOp[]) 와 같은 shape.
    -- NULL = idempotency cache 만 인 row (V8 originals — undo 안 됨).
    ADD COLUMN forward_payload JSONB,

    -- 인버스 op 시퀀스 (JSONB array). 클라가 emit 시점에 같이 전송해 저장.
    -- 단일 op 도 길이 1 array 로 통일 (frontend UndoableOp[] 와 같은 형식).
    -- NULL = 인버스 없는 op (presence 등). 그 op 는 undo 대상 아님.
    ADD COLUMN inverse_payload JSONB,

    -- Cmd+Z 가능한 끝 시점. 디폴트 emit_at + 120 min (Baserow 동일).
    -- NULL = inverse_payload 없는 op (undo 안 됨).
    ADD COLUMN reversible_until TIMESTAMPTZ,

    -- 이 op 가 이미 되돌려졌나? Cmd+Z 한 op 는 redo 가능 상태 (이 컬럼 TRUE).
    -- redo 시 다시 FALSE.
    ADD COLUMN is_undone BOOLEAN NOT NULL DEFAULT FALSE,

    -- 마지막 undone 시각 (디버깅 + redo cleanup 용).
    ADD COLUMN undone_at TIMESTAMPTZ,

    -- 클라가 ClientUndoRedoActionGroupId header 로 보낸 group id.
    -- 같은 group 의 op 들은 한번에 undo/redo. group 경계는 클라 휴리스틱.
    -- max 20 ops per group (Baserow MAX_UNDOABLE_ACTIONS_PER_ACTION_GROUP).
    ADD COLUMN action_group_id UUID,

    -- 브라우저 탭 별 UUID (클라 mount 시 localStorage 에 generate).
    -- *같은 탭의 자기 op* 만 Cmd+Z 가능 (Baserow 의 ClientSessionId 패턴).
    -- 다른 디바이스 / 다른 탭 = 다른 session = 자기 history 격리.
    ADD COLUMN client_session_id UUID,

    -- project 직접 참조 — undo lookup 의 hot path. SHEET_CELL/SHEET_TREE/DOC_TREE
    -- scope 의 scope_id 는 sheet_id 또는 project_id 라 *간접*. 직접 컬럼이 빠름.
    ADD COLUMN project_id UUID REFERENCES projects(id) ON DELETE CASCADE;

-- ─── undo 의 hot path 인덱스 ──────────────────────────────────────────
-- "사용자 X 가 세션 S 에서 가장 최근에 한 reversible 한 non-undone op" 의
-- 1 회 lookup. partial index 라 NULL reversible_until 전부 (presence / 미래
-- 다른 영역의 비-가역 op) 를 자동 제외 — 인덱스 크기 작게 유지.
CREATE INDEX op_idempotency_undo_lookup
    ON op_idempotency (user_id, client_session_id, project_id, created_at DESC)
    WHERE is_undone = FALSE AND reversible_until IS NOT NULL;

-- "5 분마다 만료된 row 정리" cron 의 hot path. created_at 인덱스 (V8) 로
-- 충분하지만 reversible_until 별도 인덱스도 cleanup hot path 빠르게.
CREATE INDEX op_idempotency_reversible_idx
    ON op_idempotency (reversible_until)
    WHERE reversible_until IS NOT NULL;

-- 같은 group 의 op 들을 한번에 lookup — Cmd+Z 시 group 단위 undo.
CREATE INDEX op_idempotency_group_idx
    ON op_idempotency (action_group_id)
    WHERE action_group_id IS NOT NULL AND is_undone = FALSE;

COMMENT ON COLUMN op_idempotency.forward_payload IS
    'Array of forward ops (UndoableOp[] in frontend type). Client sends at emit time. Used by redo to re-apply the original action. NULL = idempotency cache only (V8 originals, not undoable).';
COMMENT ON COLUMN op_idempotency.inverse_payload IS
    'Array of inverse ops (UndoableOp[] in frontend type). Client sends at emit time. NULL = op has no inverse (e.g. presence) and is not undoable.';
COMMENT ON COLUMN op_idempotency.reversible_until IS
    'Cmd+Z window end. Default emit_at + 120 min (Baserow MINUTES_UNTIL_ACTION_CLEANED_UP). After this, action is past the undo window and cleanup cron deletes the row.';
COMMENT ON COLUMN op_idempotency.action_group_id IS
    'Client-driven group id (ClientUndoRedoActionGroupId HTTP header). Max 20 ops per group (Baserow MAX_UNDOABLE_ACTIONS_PER_ACTION_GROUP). Same group is undone in one Cmd+Z press.';
COMMENT ON COLUMN op_idempotency.client_session_id IS
    'Per-tab UUID generated on frontend mount. Cmd+Z only sees own session. Different tabs of same project = different sessions = isolated histories (Baserow per-tab pattern).';
