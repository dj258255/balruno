-- SPDX-License-Identifier: AGPL-3.0-or-later
-- V15 — Share links per view (ADR 0027, 2026-05-08).
--
-- A share link is a tokened, read-only handle on a (project, sheet,
-- view) tuple. Anyone holding the token can fetch the project state
-- and render it without auth. The token is high-entropy (UUIDv4)
-- and revocable. No row/column-level ACL in this iteration — the
-- whole sheet either becomes visible or it doesn't.
--
-- Why a separate table (vs. signed JWT shared link):
--   - Revocation: deleting the row drops access immediately. JWTs
--     would need a denylist or short TTL + refresh.
--   - Audit: created_by + created_at + last_used_at gives a trail
--     for "who shared this and is anyone using it."
--   - Future per-link config: column visibility, password gate,
--     expiry change — additive ALTER, no token format churn.

CREATE TABLE share_links (
    -- UUIDv7 PK so created_at ordering is implicit (ADR 0012).
    id UUID PRIMARY KEY DEFAULT uuidv7(),

    -- The sheet to share. Project FK is denormalised so the public
    -- read endpoint can authorise project-level (e.g. soft-deleted
    -- project rejects all child links) without an extra join.
    project_id UUID NOT NULL REFERENCES projects (id) ON DELETE CASCADE,

    -- Optional sheet scope. NULL = whole project (every sheet listed
    -- in sheet_tree is visible). Set means "this sheet only" — a
    -- finer-grained share for "look at the boss balance sheet".
    sheet_id UUID,

    -- Optional view pin. When NULL the public viewer respects the
    -- sheet's current activeView (Kanban/Calendar/...). When set
    -- the share locks to that view regardless of sheet.activeView
    -- so the recipient sees what the sender intended.
    active_view TEXT,

    -- The opaque token the holder presents to the public read
    -- endpoint. UUIDv4 (random / token-y) per UUID policy. Carrying
    -- the v4 in the URL (vs. sequential v7 PK) prevents enumeration.
    token UUID NOT NULL DEFAULT gen_random_uuid(),

    -- Optional auto-expiry. NULL = no expiry. Frontend may default
    -- to "30 days from now" in the share modal.
    expires_at TIMESTAMPTZ,

    -- Soft-revoke. Set when the user clicks "Revoke" or when the
    -- project is soft-deleted. Reads must check IS NULL.
    revoked_at TIMESTAMPTZ,

    -- Who created the link. Used for the audit row in the share
    -- list panel ("Shared by alice 3 days ago").
    created_by UUID NOT NULL REFERENCES users (id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Updated by the public read endpoint on every access (best
    -- effort — not a serializable update; a denormalised hint for
    -- "this link gets traffic" diagnostics). NULL = never used.
    last_used_at TIMESTAMPTZ,

    -- Unique constraint on token — token clashes are astronomically
    -- unlikely with UUIDv4 entropy, but a duplicate would be a bug
    -- to surface immediately rather than silently overwrite.
    UNIQUE (token)
);

-- Public-read lookup: GET /api/v1/share/{token} → token IS unique
-- so this index covers the path. Partial WHERE filters out revoked
-- links so the index stays small under high churn.
CREATE INDEX share_links_active_token_idx
    ON share_links (token)
    WHERE revoked_at IS NULL;

-- Settings panel listing: "show me every link inside this project
-- the current user can manage." created_at DESC for newest-first.
CREATE INDEX share_links_project_created_idx
    ON share_links (project_id, created_at DESC);
