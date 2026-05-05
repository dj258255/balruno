-- SPDX-License-Identifier: AGPL-3.0-or-later
-- V2 — workspaces + members + invites.
--
-- Owner module: com.balruno.workspace (ADR 0015).
-- 5-tier role per ADR 0015 §3.2 — Owner/Admin/Builder/Editor/Viewer.
-- "Builder = 구조 변경 (시트 schema / 시트 트리 / 문서 트리 / project)" 정의.
-- "Editor = 내용 편집 (시트 셀 / 문서 본문)" 정의.

-- ─── workspace_role ENUM ───────────────────────────────────────────────
-- 5 values 모두 박음. 추후 ENUM ADD VALUE 가능 (REMOVE 불가, 처음에 다 박는 게 안전).
CREATE TYPE workspace_role AS ENUM ('OWNER', 'ADMIN', 'BUILDER', 'EDITOR', 'VIEWER');

-- ─── workspaces ────────────────────────────────────────────────────────
-- slug = 사용자 입력 (3-30 char, lowercase + alphanum + hyphen). 변경 가능.
-- soft delete (30일 hard delete cron 추후, ADR 0015 §6 Q4).
CREATE TABLE workspaces (
    id          UUID         PRIMARY KEY DEFAULT uuidv7(),
    slug        VARCHAR(30)  NOT NULL,
    name        VARCHAR(120) NOT NULL,
    created_by  UUID         NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    deleted_at  TIMESTAMPTZ
);

-- Active workspaces 의 slug UNIQUE (soft-deleted 는 제외 — 삭제된 slug 재사용 가능).
CREATE UNIQUE INDEX workspaces_slug_active_uk
    ON workspaces (slug) WHERE deleted_at IS NULL;

-- ─── workspace_members ─────────────────────────────────────────────────
-- 1 user 가 N workspace 에 각각 다른 role 로 참여 가능 (multi-workspace).
CREATE TABLE workspace_members (
    workspace_id  UUID            NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id       UUID            NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role          workspace_role  NOT NULL,
    joined_at     TIMESTAMPTZ     NOT NULL DEFAULT now(),
    PRIMARY KEY (workspace_id, user_id)
);

CREATE INDEX workspace_members_user_idx ON workspace_members (user_id);

-- ─── workspace_invites ─────────────────────────────────────────────────
-- Share link only (ADR 0015 §3.5, ADR 0002 의 SMTP 0 방침).
-- token_hash = SHA-256(opaque 32-byte secret). raw token 은 응답 1회만 노출.
CREATE TABLE workspace_invites (
    id              UUID            PRIMARY KEY DEFAULT uuidv7(),
    workspace_id    UUID            NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    invited_by      UUID            NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    token_hash      BYTEA           NOT NULL UNIQUE,
    role            workspace_role  NOT NULL DEFAULT 'VIEWER',
    expires_at      TIMESTAMPTZ     NOT NULL,
    accepted_at     TIMESTAMPTZ,
    accepted_by     UUID            REFERENCES users(id) ON DELETE SET NULL,
    revoked_at      TIMESTAMPTZ
);

-- "이 workspace 의 아직 사용/만료/취소되지 않은 invite" 가 hot path.
CREATE INDEX workspace_invites_active_idx
    ON workspace_invites (workspace_id, expires_at)
    WHERE accepted_at IS NULL AND revoked_at IS NULL;

-- ─── workspace_slug_redirects ──────────────────────────────────────────
-- Linear 패턴: slug 변경 후 30일 동안 옛 slug → 새 workspace_id 매핑.
-- frontend 가 옛 slug URL 받으면 이 테이블 조회 → 새 slug 로 redirect.
CREATE TABLE workspace_slug_redirects (
    old_slug       VARCHAR(30)  PRIMARY KEY,
    workspace_id   UUID         NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    redirect_until TIMESTAMPTZ  NOT NULL,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX workspace_slug_redirects_workspace_idx
    ON workspace_slug_redirects (workspace_id);
