-- SPDX-License-Identifier: AGPL-3.0-or-later
-- V16 — Webhook outbound (ADR 0028, 2026-05-08).
--
-- Outbound only. Inbound (GitHub PR sync, Discord slash commands)
-- needs provider-specific OAuth + signature verification surfaces;
-- separate ADR. Outbound = "Balruno emits an event, you receive an
-- HTTP POST."
--
-- Events covered (initial):
--   comment.added       — new comment on cell or doc
--   mention.created     — someone @ed a project member
--   row.added           — new row in a sheet
-- Future: cell.updated, sheet.created, project.member.added, etc.

CREATE TABLE webhooks (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    project_id UUID NOT NULL REFERENCES projects (id) ON DELETE CASCADE,

    -- Destination URL. Validation (must be https + reachable) is
    -- deferred to the create endpoint; the column itself just stores
    -- whatever the user supplied. TEXT (not VARCHAR) — URLs can be
    -- long once query strings + auth params are appended.
    url TEXT NOT NULL,

    -- TEXT[] of event names the user subscribed to. Postgres array
    -- (not a join table) because the cardinality is small (~10) and
    -- we always read the full set; a join would be over-engineered.
    events TEXT[] NOT NULL,

    -- Shared secret used to sign payloads. Random per webhook so a
    -- breach of one URL doesn't compromise others. UUIDv4 (random)
    -- per UUID policy. Receivers verify signature via HMAC-SHA256.
    secret UUID NOT NULL DEFAULT gen_random_uuid(),

    -- Soft on/off without delete — preserves audit + lets the user
    -- "pause" a webhook while debugging. Default true so a freshly
    -- created webhook is live.
    active BOOLEAN NOT NULL DEFAULT true,

    -- Diagnostic counters. Updated by the outbound dispatcher on
    -- every attempt; eventually consistent (no read locks). NULL
    -- on creation; first delivery sets last_attempt_at + status.
    last_attempt_at TIMESTAMPTZ,
    last_status_code INTEGER,
    last_error TEXT,

    created_by UUID NOT NULL REFERENCES users (id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Lookup: every event publish does
--   SELECT ... FROM webhooks WHERE project_id = ? AND active AND ? = ANY(events)
-- so the index covers (project_id, active=true) with events scanned
-- in the heap (small array — fine).
CREATE INDEX webhooks_project_active_idx
    ON webhooks (project_id)
    WHERE active = true;
