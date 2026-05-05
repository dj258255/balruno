-- SPDX-License-Identifier: AGPL-3.0-or-later
-- V1 — user + oauth + refresh_token + audit_log.
--
-- Owner module: com.balruno.user (ADR 0014).
-- All PKs use PG 18 native gen_random_uuidv7() per ADR 0012 §3.3.
-- All timestamps are TIMESTAMPTZ in UTC; client renders to user locale.

-- ─── users ─────────────────────────────────────────────────────────────
-- 254 = max email length per RFC 5321. We do NOT store passwords — auth is
-- OAuth-only (GitHub + Google) per project_backend_choice memory.
CREATE TABLE users (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuidv7(),
    email           VARCHAR(254) NOT NULL,
    email_verified  BOOLEAN      NOT NULL DEFAULT FALSE,
    name            VARCHAR(120),
    avatar_url      VARCHAR(2048),
    locale          VARCHAR(10)  NOT NULL DEFAULT 'ko',
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    last_login_at   TIMESTAMPTZ
);

-- Case-insensitive uniqueness — Foo@x.com == foo@x.com per provider norms.
CREATE UNIQUE INDEX users_email_lower_uk ON users (lower(email));

-- ─── oauth_accounts ────────────────────────────────────────────────────
-- A user can have multiple OAuth accounts linked (GitHub + Google etc.).
-- Auto-link on first login is gated on provider_email_verified=true to
-- prevent same-email account takeover.
CREATE TYPE oauth_provider AS ENUM ('GITHUB', 'GOOGLE');

CREATE TABLE oauth_accounts (
    id                       UUID            PRIMARY KEY DEFAULT gen_random_uuidv7(),
    user_id                  UUID            NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider                 oauth_provider  NOT NULL,
    provider_user_id         VARCHAR(120)    NOT NULL,
    provider_email           VARCHAR(254),
    provider_email_verified  BOOLEAN         NOT NULL DEFAULT FALSE,
    linked_at                TIMESTAMPTZ     NOT NULL DEFAULT now(),
    UNIQUE (provider, provider_user_id)
);

CREATE INDEX oauth_accounts_user_id_idx ON oauth_accounts (user_id);

-- ─── refresh_tokens ────────────────────────────────────────────────────
-- We never store the raw token — only SHA-256(secret). Rotation creates a
-- new row and chains via prev_id; the old row sets revoked_at. Reuse of a
-- revoked token is a sign of theft and triggers wholesale revocation of
-- the user's session chain (handled in the user module's service layer).
CREATE TABLE refresh_tokens (
    id           UUID         PRIMARY KEY DEFAULT gen_random_uuidv7(),
    user_id      UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash   BYTEA        NOT NULL UNIQUE,
    issued_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    expires_at   TIMESTAMPTZ  NOT NULL,
    revoked_at   TIMESTAMPTZ,
    prev_id      UUID         REFERENCES refresh_tokens(id),
    user_agent   VARCHAR(512),
    ip_address   INET
);

-- Hot index: "find this user's still-valid refresh tokens" on every refresh.
CREATE INDEX refresh_tokens_user_active_idx
    ON refresh_tokens (user_id) WHERE revoked_at IS NULL;

-- ─── audit_log ─────────────────────────────────────────────────────────
-- Append-only log of identity-sensitive events. Keep details flexible as
-- JSONB so adding a new event type doesn't require a schema migration.
-- Examples: oauth.link, oauth.unlink, login.success, refresh.rotate,
-- refresh.theft_detected.
CREATE TABLE audit_log (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuidv7(),
    occurred_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    actor_user_id   UUID         REFERENCES users(id) ON DELETE SET NULL,
    event_type      VARCHAR(80)  NOT NULL,
    details         JSONB        NOT NULL DEFAULT '{}'::jsonb,
    ip_address      INET,
    user_agent      VARCHAR(512)
);

CREATE INDEX audit_log_occurred_at_idx ON audit_log (occurred_at DESC);
CREATE INDEX audit_log_actor_idx ON audit_log (actor_user_id)
    WHERE actor_user_id IS NOT NULL;
