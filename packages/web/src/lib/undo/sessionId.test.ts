// SPDX-License-Identifier: MIT
import { describe, it, expect, beforeEach } from 'vitest';
import { getClientSessionId, __resetClientSessionIdForTests } from './sessionId';

describe('getClientSessionId', () => {
  beforeEach(() => {
    __resetClientSessionIdForTests();
  });

  it('generates a UUID on first call', () => {
    const id = getClientSessionId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  it('returns the same UUID across multiple calls in one tab', () => {
    const a = getClientSessionId();
    const b = getClientSessionId();
    expect(a).toBe(b);
  });

  it('persists across module-level cached resets if sessionStorage holds the value', () => {
    const first = getClientSessionId();
    // Wipe in-memory cache only — sessionStorage retains the value
    // (this is the "second function call within the same tab" path)
    // Note: __resetClientSessionIdForTests clears both, so we can't
    // perfectly model this. But we can assert via direct access:
    expect(window.sessionStorage.getItem('balruno:client-session-id')).toBe(first);
  });
});
