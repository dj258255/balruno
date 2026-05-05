-- SPDX-License-Identifier: AGPL-3.0-or-later
-- V2 — workspaces + members + invites.
--
-- Owner module: com.balruno.workspace (ADR 0015).
-- Roles follow the 5-tier model from ADR 0015 §3.2 — Owner / Admin /
-- Builder / Editor / Viewer. Builder owns structural changes (sheet
-- schema, sheet tree, doc tree, project), Editor owns content edits
-- (sheet cells, doc body).

-- ─── workspace_role ENUM ───────────────────────────────────────────────
-- All five values are declared up front. PG allows ENUM ADD VALUE later
-- but never REMOVE — adding upfront is the safe choice.
CREATE TYPE workspace_role AS ENUM ('OWNER', 'ADMIN', 'BUILDER', 'EDITOR', 'VIEWER');

-- ─── workspaces ────────────────────────────────────────────────────────
-- slug = user-supplied (3-30 chars, [a-z0-9][a-z0-9-]+), mutable.
-- soft delete via deleted_at; a hard-delete cron after 30 days is a
-- follow-up (ADR 0015 §6 Q4).
CREATE TABLE workspaces (
    id          UUID         PRIMARY KEY DEFAULT uuidv7(),
    slug        VARCHAR(30)  NOT NULL,
    name        VARCHAR(120) NOT NULL,
    created_by  UUID         NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    deleted_at  TIMESTAMPTZ
);

-- Slug uniqueness scoped to active rows — a soft-deleted workspace's
-- slug becomes available again.
CREATE UNIQUE INDEX workspaces_slug_active_uk
    ON workspaces (slug) WHERE deleted_at IS NULL;

-- ─── workspace_members ─────────────────────────────────────────────────
-- One user can join many workspaces with different roles (multi-workspace
-- per user is the standard, per ADR 0015 §3.4).
CREATE TABLE workspace_members (
    workspace_id  UUID            NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id       UUID            NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role          workspace_role  NOT NULL,
    joined_at     TIMESTAMPTZ     NOT NULL DEFAULT now(),
    PRIMARY KEY (workspace_id, user_id)
);

CREATE INDEX workspace_members_user_idx ON workspace_members (user_id);

-- ─── workspace_invites ─────────────────────────────────────────────────
-- Share-link only flow (ADR 0015 §3.5, ADR 0002 SMTP-free policy).
-- token_hash stores SHA-256 of an opaque 32-byte secret. The raw token
-- is returned to the inviter exactly once.
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

-- Hot path: "the still-pending invites of this workspace".
CREATE INDEX workspace_invites_active_idx
    ON workspace_invites (workspace_id, expires_at)
    WHERE accepted_at IS NULL AND revoked_at IS NULL;

-- ─── workspace_slug_redirects ──────────────────────────────────────────
-- After a slug change we keep the old slug → workspace_id mapping for
-- 30 days (Linear pattern, ADR 0015 §3.6). The frontend looks up the
-- mapping here on a 404 and issues a redirect to the new slug.
CREATE TABLE workspace_slug_redirects (
    old_slug       VARCHAR(30)  PRIMARY KEY,
    workspace_id   UUID         NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    redirect_until TIMESTAMPTZ  NOT NULL,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX workspace_slug_redirects_workspace_idx
    ON workspace_slug_redirects (workspace_id);
