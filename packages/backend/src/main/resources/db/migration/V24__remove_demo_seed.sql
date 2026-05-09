-- SPDX-License-Identifier: AGPL-3.0-or-later
-- V24 — Remove the V23 anonymous-demo seed (2026-05-08).
--
-- The Excalidraw-style anonymous landing demo was reverted: the
-- root URL now goes straight to /workspaces (auth) or /login.
-- AnonymousDemoController + the AnonymousDemoBanner have been
-- deleted from the codebase, so the seeded rows are dead weight.
--
-- V23 is immutable (Flyway checksum policy); we delete its rows
-- here in dependency order. Sheet content / op_log rows referenced
-- by the demo project cascade through their FK ON DELETE CASCADE
-- definitions in V11+ migrations.

DELETE FROM projects
WHERE id = '00000000-0000-0000-0000-0000000d3002';

DELETE FROM workspace_members
WHERE workspace_id = '00000000-0000-0000-0000-0000000d3001';

DELETE FROM workspaces
WHERE id = '00000000-0000-0000-0000-0000000d3001';

DELETE FROM users
WHERE id = '00000000-0000-0000-0000-0000000d3000';
