// SPDX-License-Identifier: MIT
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  nextActionGroupId,
  rotateActionGroup,
  __resetActionGroupForTests,
} from './actionGroup';

describe('nextActionGroupId', () => {
  beforeEach(() => {
    __resetActionGroupForTests();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns the same id within the active group window', () => {
    const a = nextActionGroupId();
    const b = nextActionGroupId();
    expect(a).toBe(b);
  });

  it('rotates after 30 seconds idle', () => {
    const a = nextActionGroupId();
    vi.advanceTimersByTime(30_001);
    const b = nextActionGroupId();
    expect(a).not.toBe(b);
  });

  it('rotates after 20 ops in one group', () => {
    const first = nextActionGroupId();
    for (let i = 0; i < 19; i++) nextActionGroupId();
    // 20th call still in same group
    const last = nextActionGroupId();
    expect(last).not.toBe(first);
  });

  it('rotateActionGroup forces a fresh id on next call', () => {
    const a = nextActionGroupId();
    rotateActionGroup();
    const b = nextActionGroupId();
    expect(a).not.toBe(b);
  });
});
