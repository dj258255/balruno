-- SPDX-License-Identifier: AGPL-3.0-or-later
-- V23 — Anonymous multiplayer demo (ADR 0035, 2026-05-08).
--
-- Seeds a hardcoded user + workspace + project + sheet so that
-- balruno.com root can render a real collaborative sheet UI to
-- anonymous visitors. Excalidraw home pattern: load the canvas
-- straight away, multiplayer with whoever else is on it.
--
-- All UUIDs are deterministic (hex only — no 'm/p/r/s/etc.' chars)
-- so frontend + DemoController can reference the same ids without a
-- runtime lookup. Daily reset (Spring @Scheduled) restores the
-- sheet contents to the seed; the user / workspace / project rows
-- themselves are immutable.
--
-- ID convention (all 8-4-4-4-12 hex):
--   User:      00000000-0000-0000-0000-0000000d3000
--   Workspace: 00000000-0000-0000-0000-0000000d3001
--   Project:   00000000-0000-0000-0000-0000000d3002
--   Sheet:     00000000-0000-0000-0000-0000000d3010
--   Columns:   00000000-0000-0000-0000-0000000d3c01..d3c05
--   Rows:      00000000-0000-0000-0000-0000000d3a01..d3a04

INSERT INTO users (id, email, email_verified, name, locale)
VALUES (
    '00000000-0000-0000-0000-0000000d3000',
    'demo@balruno.local',
    true,
    'Demo Visitor',
    'ko'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO workspaces (id, slug, name, created_by)
VALUES (
    '00000000-0000-0000-0000-0000000d3001',
    'demo',
    'Public Demo',
    '00000000-0000-0000-0000-0000000d3000'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO workspace_members (workspace_id, user_id, role)
VALUES (
    '00000000-0000-0000-0000-0000000d3001',
    '00000000-0000-0000-0000-0000000d3000',
    'BUILDER'
) ON CONFLICT (workspace_id, user_id) DO NOTHING;

INSERT INTO projects (
    id, workspace_id, slug, name, description, created_by,
    data, data_version,
    sheet_tree, sheet_tree_version
)
VALUES (
    '00000000-0000-0000-0000-0000000d3002',
    '00000000-0000-0000-0000-0000000d3001',
    'playground',
    'Public Playground',
    '익명 방문자가 다같이 편집하는 데모 프로젝트. 자정 UTC 마다 자동 리셋.',
    '00000000-0000-0000-0000-0000000d3000',
    '[
        {
            "id": "00000000-0000-0000-0000-0000000d3010",
            "name": "RPG Classes",
            "icon": "⚔️",
            "columns": [
                { "id": "00000000-0000-0000-0000-0000000d3c01", "name": "Class",  "type": "general",  "width": 140 },
                { "id": "00000000-0000-0000-0000-0000000d3c02", "name": "HP",     "type": "general",  "width": 100 },
                { "id": "00000000-0000-0000-0000-0000000d3c03", "name": "STR",    "type": "general",  "width": 100 },
                { "id": "00000000-0000-0000-0000-0000000d3c04", "name": "AGI",    "type": "general",  "width": 100 },
                { "id": "00000000-0000-0000-0000-0000000d3c05", "name": "Note",   "type": "general",  "width": 240 }
            ],
            "rows": [
                {
                    "id": "00000000-0000-0000-0000-0000000d3a01",
                    "cells": {
                        "00000000-0000-0000-0000-0000000d3c01": "Knight",
                        "00000000-0000-0000-0000-0000000d3c02": "120",
                        "00000000-0000-0000-0000-0000000d3c03": "15",
                        "00000000-0000-0000-0000-0000000d3c04": "8",
                        "00000000-0000-0000-0000-0000000d3c05": "탱커. 방어력 high."
                    }
                },
                {
                    "id": "00000000-0000-0000-0000-0000000d3a02",
                    "cells": {
                        "00000000-0000-0000-0000-0000000d3c01": "Mage",
                        "00000000-0000-0000-0000-0000000d3c02": "60",
                        "00000000-0000-0000-0000-0000000d3c03": "5",
                        "00000000-0000-0000-0000-0000000d3c04": "10",
                        "00000000-0000-0000-0000-0000000d3c05": "원거리 마법 딜러."
                    }
                },
                {
                    "id": "00000000-0000-0000-0000-0000000d3a03",
                    "cells": {
                        "00000000-0000-0000-0000-0000000d3c01": "Archer",
                        "00000000-0000-0000-0000-0000000d3c02": "80",
                        "00000000-0000-0000-0000-0000000d3c03": "10",
                        "00000000-0000-0000-0000-0000000d3c04": "15",
                        "00000000-0000-0000-0000-0000000d3c05": "민첩 + 크리티컬 빌드."
                    }
                },
                {
                    "id": "00000000-0000-0000-0000-0000000d3a04",
                    "cells": {
                        "00000000-0000-0000-0000-0000000d3c01": "Cleric",
                        "00000000-0000-0000-0000-0000000d3c02": "90",
                        "00000000-0000-0000-0000-0000000d3c03": "8",
                        "00000000-0000-0000-0000-0000000d3c04": "7",
                        "00000000-0000-0000-0000-0000000d3c05": "힐링 + 보조."
                    }
                }
            ]
        }
    ]'::jsonb,
    1,
    '[
        {
            "id": "00000000-0000-0000-0000-0000000d3010",
            "name": "RPG Classes",
            "type": "sheet"
        }
    ]'::jsonb,
    1
) ON CONFLICT (id) DO NOTHING;
