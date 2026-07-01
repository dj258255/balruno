// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.sync.internal;

/**
 * Mirror of the PG ENUM {@code op_scope_kind} (V8). Two regions ride
 * the {@code /ws/projects/{id}} channel and touch op_idempotency.
 * The PG enum still carries the legacy {@code DOC_TREE} value (enum
 * values can't be dropped) but Java never emits it.
 *
 * Adding a value (e.g. {@code COMMENT_THREAD}) requires both:
 *   1. PG: {@code ALTER TYPE op_scope_kind ADD VALUE 'COMMENT_THREAD';}
 *      via a new V*.sql.
 *   2. Java: append the constant here.
 * PG enum supports ADD but not REMOVE — think before adding.
 */
enum OpScopeKind {
    SHEET_CELL,
    SHEET_TREE,
}
