/**
 * Module-level undo / redo stack — ADR 0021 stage A.
 *
 * Per-user, per-project (key = `${userId}:${projectId}`) stack of
 * (forward-op, inverse-op) pairs. cellSlice / docSlice / page handlers
 * push entries right after a successful emit; Cmd+Z pops the top entry,
 * emits the inverse via writeQueue.emitOp, and parks the entry on the
 * redo stack.
 *
 * Why a module singleton instead of a zustand store: the historyStore
 * already exposes the consumer-facing API (canUndo / canRedo / undo /
 * redo). This module just owns the data structure; historyStore delegates.
 *
 * Multi-user isolation comes from the stackKey — peer broadcasts arrive
 * with someone else's userId, so they never land on the local user's
 * stack. The local user's own echo also doesn't push (push happens at
 * emit time, not on broadcast receipt).
 */

import type { ClientOp } from '@/hooks/useProjectSync';

/** A pair of (forward op, inverse op). The forward op is what the
 *  user just did; the inverse op undoes it. Both are full ClientOp
 *  shapes minus version/clientMsgId — those are filled in at emit
 *  time from the live writeQueue state. */
export interface UndoEntry {
  /** Description shown in undo history UI ("Cell update", "Row add"). */
  label: string;
  /** Op the user just performed — used for redo (re-emit). */
  forward: UndoableOp;
  /** Op that undoes the forward op — emitted on Cmd+Z. */
  inverse: UndoableOp;
  /** Wall-clock time of the original emit, for chronological display. */
  timestamp: number;
}

/** Subset of ClientOp that supports undo. presence/sync.full etc. don't. */
export type UndoableOp = Extract<
  ClientOp,
  {
    type:
      | 'cell.update'
      | 'row.add'
      | 'row.delete'
      | 'row.move'
      | 'column.add'
      | 'column.update'
      | 'column.delete'
      | 'tree.add'
      | 'tree.move'
      | 'tree.delete'
      | 'tree.rename';
  }
>;

const MAX_STACK_DEPTH = 50;

interface PerProjectStack {
  undo: UndoEntry[];
  redo: UndoEntry[];
}

const stacks = new Map<string, PerProjectStack>();
const listeners = new Set<() => void>();

let activeKey: string | null = null;

function makeKey(userId: string, projectId: string): string {
  return `${userId}:${projectId}`;
}

function getStack(key: string): PerProjectStack {
  let s = stacks.get(key);
  if (!s) {
    s = { undo: [], redo: [] };
    stacks.set(key, s);
  }
  return s;
}

function notify(): void {
  for (const fn of listeners) fn();
}

/** Mark the active (userId, projectId) — historyStore reads from here.
 *  Called at project page mount; null on unmount. */
export function setActiveStack(userId: string | null, projectId: string | null): void {
  activeKey = userId && projectId ? makeKey(userId, projectId) : null;
  notify();
}

/** Push a new entry onto the active project's undo stack. Clears the
 *  redo stack — once the user does something new, the future is gone
 *  (Notion / Airtable convention).
 *  Caller passes (userId, projectId) explicitly so cellSlice can push
 *  even before activeKey is set (rare, but defensive). */
export function pushUndo(
  userId: string,
  projectId: string,
  entry: UndoEntry,
): void {
  const key = makeKey(userId, projectId);
  const s = getStack(key);
  s.undo.push(entry);
  if (s.undo.length > MAX_STACK_DEPTH) s.undo.shift();
  s.redo = [];
  notify();
}

/** Pop the top of the active project's undo stack, return the entry
 *  to be applied as inverse, and stash it on the redo stack. */
export function popUndo(): UndoEntry | null {
  if (!activeKey) return null;
  const s = getStack(activeKey);
  const entry = s.undo.pop();
  if (!entry) return null;
  s.redo.push(entry);
  if (s.redo.length > MAX_STACK_DEPTH) s.redo.shift();
  notify();
  return entry;
}

/** Pop the top of the redo stack, return the entry to re-emit forward,
 *  and push it back onto the undo stack. */
export function popRedo(): UndoEntry | null {
  if (!activeKey) return null;
  const s = getStack(activeKey);
  const entry = s.redo.pop();
  if (!entry) return null;
  s.undo.push(entry);
  if (s.undo.length > MAX_STACK_DEPTH) s.undo.shift();
  notify();
  return entry;
}

export function canUndo(): boolean {
  if (!activeKey) return false;
  return getStack(activeKey).undo.length > 0;
}

export function canRedo(): boolean {
  if (!activeKey) return false;
  return getStack(activeKey).redo.length > 0;
}

export function clearActiveStack(): void {
  if (!activeKey) return;
  stacks.set(activeKey, { undo: [], redo: [] });
  notify();
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function __resetForTests(): void {
  stacks.clear();
  listeners.clear();
  activeKey = null;
}
