-- SPDX-License-Identifier: AGPL-3.0-or-later
-- V18 — Inbound webhooks (ADR 0029, 2026-05-08).
--
-- Receive HTTP POSTs from external systems (GitHub PR, Discord
-- slash command, generic) and turn them into rows on a target sheet.
-- Reverse direction of V16 (which we send out from balruno).
--
-- Generic provider: any system can POST a JSON body that maps to
-- column ids via column_mapping. GitHub provider: signature header
-- = X-Hub-Signature-256 (sha256= HMAC), payload = pull_request /
-- issues / push events (we map title + url + state to columns).

CREATE TABLE inbound_webhooks (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    project_id UUID NOT NULL REFERENCES projects (id) ON DELETE CASCADE,

    -- Provider semantic. Drives signature verification + payload
    -- mapping logic. 'generic' = no signature, payload mapped via
    -- column_mapping verbatim. 'github' = X-Hub-Signature-256 +
    -- pull_request/issues/push event mapper.
    provider TEXT NOT NULL CHECK (provider IN ('github', 'generic')),

    -- Which sheet receives the auto-generated rows. The user picks
    -- this when minting the webhook from the UI.
    target_sheet_id UUID NOT NULL,

    -- Shared secret. For 'github' = the webhook secret you paste
    -- into GitHub's webhook config. For 'generic' = a random token
    -- the sender sends in X-Balruno-Signature.
    secret UUID NOT NULL DEFAULT gen_random_uuid(),

    -- Optional column mapping. Provider-specific defaults apply
    -- when this is NULL ({title: <first text col>, url: <first url col>,
    -- status: <first select col>} for github). Non-null overrides.
    column_mapping JSONB,

    -- Soft on/off without delete (debug pause).
    active BOOLEAN NOT NULL DEFAULT true,

    -- Diagnostic counters.
    last_received_at TIMESTAMPTZ,
    last_status TEXT,        -- 'ok' / 'invalid_signature' / 'mapping_failed' / ...
    last_error TEXT,

    created_by UUID NOT NULL REFERENCES users (id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX inbound_webhooks_project_idx
    ON inbound_webhooks (project_id);
