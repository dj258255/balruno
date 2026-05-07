// SPDX-License-Identifier: MIT
import { afterEach, describe, it, expect } from 'vitest';

import {
  __resetForTests,
  canRedo,
  canUndo,
  clearActiveStack,
  popRedo,
  popUndo,
  pushUndo,
  setActiveStack,
  subscribe,
  type UndoEntry,
} from './undoStack';

const USER = 'user-1';
const PROJECT = 'project-1';

function makeEntry(label: string): UndoEntry {
  return {
    label,
    forward: [{ type: 'cell.update', sheetId: 's', rowId: 'r', columnId: 'c', value: 'fwd', baseVersion: 0, clientMsgId: '' }],
    inverse: [{ type: 'cell.update', sheetId: 's', rowId: 'r', columnId: 'c', value: 'inv', baseVersion: 0, clientMsgId: '' }],
    timestamp: Date.now(),
  };
}

afterEach(() => {
  __resetForTests();
});

describe('undoStack', () => {
  it('pushes onto the active stack and reports canUndo/canRedo', () => {
    setActiveStack(USER, PROJECT);
    expect(canUndo()).toBe(false);
    pushUndo(USER, PROJECT, makeEntry('a'));
    expect(canUndo()).toBe(true);
    expect(canRedo()).toBe(false);
  });

  it('popUndo moves entries to redo stack', () => {
    setActiveStack(USER, PROJECT);
    pushUndo(USER, PROJECT, makeEntry('a'));
    pushUndo(USER, PROJECT, makeEntry('b'));
    const popped = popUndo();
    expect(popped?.label).toBe('b');
    expect(canRedo()).toBe(true);
  });

  it('popRedo moves entries back to undo stack', () => {
    setActiveStack(USER, PROJECT);
    pushUndo(USER, PROJECT, makeEntry('a'));
    popUndo();
    expect(canUndo()).toBe(false);
    expect(canRedo()).toBe(true);
    const popped = popRedo();
    expect(popped?.label).toBe('a');
    expect(canUndo()).toBe(true);
    expect(canRedo()).toBe(false);
  });

  it('pushUndo clears the redo stack — once new history happens, future is gone', () => {
    setActiveStack(USER, PROJECT);
    pushUndo(USER, PROJECT, makeEntry('a'));
    popUndo(); // a now on redo
    expect(canRedo()).toBe(true);
    pushUndo(USER, PROJECT, makeEntry('b'));
    expect(canRedo()).toBe(false); // a was discarded
  });

  it('per-(user, project) isolation — peer pushes do not appear on local stack', () => {
    setActiveStack(USER, PROJECT);
    pushUndo('peer', PROJECT, makeEntry('peer-edit'));
    // local is alice, but the entry was pushed under peer's id
    expect(canUndo()).toBe(false);
  });

  it('returns null on empty stacks', () => {
    setActiveStack(USER, PROJECT);
    expect(popUndo()).toBeNull();
    expect(popRedo()).toBeNull();
  });

  it('clearActiveStack drops both undo + redo for the active project', () => {
    setActiveStack(USER, PROJECT);
    pushUndo(USER, PROJECT, makeEntry('a'));
    pushUndo(USER, PROJECT, makeEntry('b'));
    popUndo();
    expect(canUndo()).toBe(true);
    expect(canRedo()).toBe(true);
    clearActiveStack();
    expect(canUndo()).toBe(false);
    expect(canRedo()).toBe(false);
  });

  it('caps the stack at MAX_STACK_DEPTH (50) — oldest gets dropped', () => {
    setActiveStack(USER, PROJECT);
    for (let i = 0; i < 60; i++) pushUndo(USER, PROJECT, makeEntry(`e${i}`));
    // popping 50 should drain the stack, the oldest 10 are gone
    let count = 0;
    while (popUndo()) count++;
    expect(count).toBe(50);
  });

  it('subscribe fires on every push', () => {
    setActiveStack(USER, PROJECT);
    let calls = 0;
    const unsub = subscribe(() => { calls++; });
    pushUndo(USER, PROJECT, makeEntry('a'));
    pushUndo(USER, PROJECT, makeEntry('b'));
    expect(calls).toBeGreaterThanOrEqual(2);
    unsub();
  });

  it('canUndo / canRedo return false when no active project is set', () => {
    setActiveStack(null, null);
    pushUndo(USER, PROJECT, makeEntry('a'));
    expect(canUndo()).toBe(false);
    expect(canRedo()).toBe(false);
  });
});
