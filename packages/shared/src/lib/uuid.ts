/**
 * UUID generation policy — Balruno.
 *
 * Two helpers, single import path. Direct `import { v4 } from 'uuid'` is
 * discouraged so that future changes (e.g. moving to a different generator,
 * adding a TypeID-style prefix, or swapping for native crypto.randomUUID)
 * happen in exactly one place.
 *
 * Decision: ADR 0012 — UUID strategy (v7 PK / v4 token).
 *
 * - {@link newId}    — UUIDv7 (time-ordered). Use for primary keys
 *                      (Project / Sheet / Row / Column / Doc / Comment /
 *                      Branch / Snapshot / clientMsgId). Sortable in
 *                      lexicographic order, B-tree friendly when stored
 *                      as a Postgres `uuid` column. PG 18's native
 *                      `gen_random_uuidv7()` round-trips to the same
 *                      type, so client-issued IDs feed straight into
 *                      the index without coercion.
 *
 * - {@link randomId} — UUIDv4 (random). Use for values where unguessability
 *                      is the goal: WebRTC sync room tokens, user-visible
 *                      `/uuid` slash command, anywhere a creation-timestamp
 *                      leak via the ID would be undesirable.
 *
 * Auth tokens (refresh, collab, invite, reset) are NOT UUIDs — see
 * docs/backend/01-auth.md §4 for those (32-byte base64url random).
 */

import { v4, v7 } from 'uuid';

/** Time-ordered UUID v7 — default for primary keys. */
export const newId = (): string => v7();

/** Random UUID v4 — only when unguessability matters more than ordering. */
export const randomId = (): string => v4();
