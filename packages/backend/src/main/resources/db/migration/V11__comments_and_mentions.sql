-- SPDX-License-Identifier: AGPL-3.0-or-later
-- V11 — comments + mentions (ADR 0024 Stage A).
--
-- 두 scope (SHEET_CELL + DOC_BODY) 의 코멘트 + thread 응답 + resolve
-- workflow + @user mention 추적. ADR 0008 의 4 region (sheet cell +
-- sheet tree + doc tree + doc body) 외 *5번째 region* 이지만 *별도
-- op log 안 가짐* — 단순 CRUD + broadcast 로 충분 (ADR 0024 §2.1).
--
-- body_html 대신 body_json (Tiptap JSON) 으로 저장 — Q1 결정. HTML
-- 은 markup 변경 시 깨짐, JSON 은 역호환 안전.

-- ─── comment_scope_kind ENUM ─────────────────────────────────────────
CREATE TYPE comment_scope_kind AS ENUM ('SHEET_CELL', 'DOC_BODY');

-- ─── comments ────────────────────────────────────────────────────────
-- scope_kind = SHEET_CELL  → sheet_id + row_id + column_id 필수
-- scope_kind = DOC_BODY    → document_id 필수, anchor_position 선택
-- parent_id NULL = thread root, NOT NULL = thread reply
CREATE TABLE comments (
    id              UUID         PRIMARY KEY DEFAULT uuidv7(),
    project_id      UUID         NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    scope_kind      comment_scope_kind NOT NULL,

    -- SHEET_CELL anchors. NULLs verified by CHECK below.
    sheet_id        UUID,
    row_id          UUID,
    column_id       UUID,

    -- DOC_BODY anchors. document_id is the doc tree leaf id (matches
    -- documents.id which is the same uuid). anchor_position is the
    -- Tiptap document position the comment pins to (null = whole-doc
    -- comment, not a range).
    document_id     UUID         REFERENCES documents(id) ON DELETE CASCADE,
    anchor_position INT,

    -- thread root has NULL parent_id; replies point at the root.
    parent_id       UUID         REFERENCES comments(id) ON DELETE CASCADE,

    author_user_id  UUID         NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    body_json       JSONB        NOT NULL,

    resolved        BOOLEAN      NOT NULL DEFAULT FALSE,
    resolved_by     UUID         REFERENCES users(id) ON DELETE SET NULL,
    resolved_at     TIMESTAMPTZ,

    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ,

    -- Anchor invariants — each scope_kind requires its own non-null set.
    CONSTRAINT comments_scope_anchor_check CHECK (
        (scope_kind = 'SHEET_CELL'
         AND sheet_id IS NOT NULL
         AND row_id IS NOT NULL
         AND column_id IS NOT NULL
         AND document_id IS NULL
         AND anchor_position IS NULL)
     OR (scope_kind = 'DOC_BODY'
         AND document_id IS NOT NULL
         AND sheet_id IS NULL
         AND row_id IS NULL
         AND column_id IS NULL)
    ),

    -- resolved invariants — resolved_by + resolved_at travel together.
    CONSTRAINT comments_resolved_pair_check CHECK (
        (resolved = FALSE AND resolved_by IS NULL AND resolved_at IS NULL)
     OR (resolved = TRUE  AND resolved_by IS NOT NULL AND resolved_at IS NOT NULL)
    )
);

-- 핫 path: 시트의 특정 cell 에 달린 코멘트 list / 문서의 코멘트 list.
-- soft-deleted (deleted_at IS NOT NULL) 는 제외.
CREATE INDEX comments_sheet_cell_idx
    ON comments (project_id, sheet_id, row_id, column_id)
    WHERE scope_kind = 'SHEET_CELL' AND deleted_at IS NULL;

CREATE INDEX comments_doc_body_idx
    ON comments (project_id, document_id)
    WHERE scope_kind = 'DOC_BODY' AND deleted_at IS NULL;

-- thread reply 조회 (parent_id 안 NULL).
CREATE INDEX comments_parent_idx
    ON comments (parent_id)
    WHERE parent_id IS NOT NULL AND deleted_at IS NULL;

-- 사용자별 인박스 — 받은 mentions.
CREATE INDEX comments_author_idx
    ON comments (author_user_id, created_at DESC)
    WHERE deleted_at IS NULL;

-- ─── mentions ────────────────────────────────────────────────────────
-- 코멘트 본문에 박힌 @user reference 의 *materialised view*. body_json
-- parse 의 결과를 backend 가 별도 row 로 풀어 저장 → 인박스 / 알림 조회
-- 가 SQL one-shot 으로 가능.
CREATE TABLE mentions (
    comment_id      UUID         NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
    mentioned_user  UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    notified        BOOLEAN      NOT NULL DEFAULT FALSE,
    notified_at     TIMESTAMPTZ,
    PRIMARY KEY (comment_id, mentioned_user)
);

-- 사용자의 미확인 mention 목록 (인박스 unread filter).
CREATE INDEX mentions_unread_idx
    ON mentions (mentioned_user, notified)
    WHERE notified = FALSE;
