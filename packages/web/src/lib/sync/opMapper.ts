/**
 * Store action → wire-format ClientOp mapper (ADR 0018 Stage A).
 *
 * The frontend has 11 store actions that mutate sheet / tree state and
 * the backend has 11 ClientOp variants in {@link ClientOp}; the shapes
 * are nearly 1:1 by design (ADR 0008 v2.0 picked op names that map onto
 * Linear / Baserow's command vocabulary, which is also how our
 * projectStore is organised). This file is the thin layer that adds the
 * three sync-only fields a store action doesn't carry — sheetId scope,
 * baseVersion, clientMsgId — and emits the wire frame.
 *
 * `clientMsgId` is a UUIDv4 (random / token-y) per memory's UUID
 * policy: it is the PK of the backend's op_idempotency cache, so
 * collision resistance matters more than time-ordering.
 *
 * Sticker actions and doc-body actions are intentionally NOT mapped —
 * stickers stay local-only in v0.5 (ADR 0008 §3.6 deferred), and doc
 * body lives on the separate Hocuspocus channel (ADR 0017 §2.1
 * pattern B).
 */

import type { Column, Row, CellValue } from '@balruno/shared';
import { randomId } from '@/lib/uuid';
import type { ClientOp } from '@/hooks/useProjectSync';

/**
 * The {@link ClientOp} union has one variant — `presence` — without a
 * `clientMsgId` because presence frames are fire-and-forget (no
 * idempotency, no ack, no broadcast echo). The mapper never produces
 * presence; constraining the return type to the idempotent subset
 * lets call sites read clientMsgId / baseVersion without union
 * narrowing.
 */
export type MappedClientOp = Exclude<ClientOp, { type: 'presence' }>;

/**
 * Closed enumeration of store actions that have a sync wire counterpart.
 * The mapper takes one of these (the *intent* of the action, free of
 * sync-specific fields) and produces a ClientOp ready for the
 * useProjectSync.send() call.
 */
export type StoreActionIntent =
  | { kind: 'cell.update'; sheetId: string; rowId: string; columnId: string; value: CellValue }
  | { kind: 'row.add'; sheetId: string; row: Row }
  | { kind: 'row.delete'; sheetId: string; rowId: string }
  | { kind: 'row.move'; sheetId: string; rowId: string; toIndex: number }
  | { kind: 'column.add'; sheetId: string; column: Column }
  | { kind: 'column.update'; sheetId: string; columnId: string; patch: Partial<Column> }
  | { kind: 'column.delete'; sheetId: string; columnId: string }
  | { kind: 'tree.add'; treeKind: 'SHEET' | 'DOC'; parentId: string | null; position: number; node: unknown }
  | { kind: 'tree.move'; treeKind: 'SHEET' | 'DOC'; nodeId: string; newParentId: string | null; newPosition: number }
  | { kind: 'tree.delete'; treeKind: 'SHEET' | 'DOC'; nodeId: string }
  | { kind: 'tree.rename'; treeKind: 'SHEET' | 'DOC'; nodeId: string; newName: string };

/**
 * Translate a store-level intent into a wire-format ClientOp. The
 * caller supplies the current baseVersion (from sync.full / op.acked
 * tracking); this function only adds the sync envelope.
 */
export function mapStoreActionToOp(intent: StoreActionIntent, baseVersion: number): MappedClientOp {
  const clientMsgId = randomId();
  switch (intent.kind) {
    case 'cell.update':
      return {
        type: 'cell.update',
        sheetId: intent.sheetId,
        rowId: intent.rowId,
        columnId: intent.columnId,
        value: intent.value,
        baseVersion,
        clientMsgId,
      };
    case 'row.add':
      return {
        type: 'row.add',
        sheetId: intent.sheetId,
        row: intent.row,
        baseVersion,
        clientMsgId,
      };
    case 'row.delete':
      return {
        type: 'row.delete',
        sheetId: intent.sheetId,
        rowId: intent.rowId,
        baseVersion,
        clientMsgId,
      };
    case 'row.move':
      return {
        type: 'row.move',
        sheetId: intent.sheetId,
        rowId: intent.rowId,
        toIndex: intent.toIndex,
        baseVersion,
        clientMsgId,
      };
    case 'column.add':
      return {
        type: 'column.add',
        sheetId: intent.sheetId,
        column: intent.column,
        baseVersion,
        clientMsgId,
      };
    case 'column.update':
      return {
        type: 'column.update',
        sheetId: intent.sheetId,
        columnId: intent.columnId,
        patch: intent.patch,
        baseVersion,
        clientMsgId,
      };
    case 'column.delete':
      return {
        type: 'column.delete',
        sheetId: intent.sheetId,
        columnId: intent.columnId,
        baseVersion,
        clientMsgId,
      };
    case 'tree.add':
      return {
        type: 'tree.add',
        treeKind: intent.treeKind,
        parentId: intent.parentId,
        position: intent.position,
        node: intent.node,
        baseVersion,
        clientMsgId,
      };
    case 'tree.move':
      return {
        type: 'tree.move',
        treeKind: intent.treeKind,
        nodeId: intent.nodeId,
        newParentId: intent.newParentId,
        newPosition: intent.newPosition,
        baseVersion,
        clientMsgId,
      };
    case 'tree.delete':
      return {
        type: 'tree.delete',
        treeKind: intent.treeKind,
        nodeId: intent.nodeId,
        baseVersion,
        clientMsgId,
      };
    case 'tree.rename':
      return {
        type: 'tree.rename',
        treeKind: intent.treeKind,
        nodeId: intent.nodeId,
        newName: intent.newName,
        baseVersion,
        clientMsgId,
      };
  }
}
