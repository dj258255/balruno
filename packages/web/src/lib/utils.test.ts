/**
 * utils.ts unit tests — pure formatting helpers.
 *
 * formatRelativeTime returns Korean copy ("방금 전" / "5분 전" / etc.)
 * for sidebar timestamps. cn merges Tailwind class strings via
 * tailwind-merge — verifying the conflict resolution behaviour
 * (later class wins on the same property).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { cn, formatRelativeTime } from './utils';

describe('cn — tailwind class merge', () => {
  it('joins simple classes with space', () => {
    expect(cn('a', 'b')).toBe('a b');
  });

  it('drops falsy values', () => {
    expect(cn('a', false, null, undefined, 'b')).toBe('a b');
  });

  it('later conflicting tailwind class wins', () => {
    // tailwind-merge dedupes property conflicts so the final class is
    // unambiguous — `p-2 p-4` resolves to `p-4`. Without this the
    // browser's CSS specificity would still pick the later one but
    // the DOM carries dead classes.
    expect(cn('p-2', 'p-4')).toBe('p-4');
  });

  it('keeps non-conflicting classes alongside merged property', () => {
    expect(cn('text-red-500', 'p-2', 'text-blue-500')).toContain('text-blue-500');
    expect(cn('text-red-500', 'p-2', 'text-blue-500')).toContain('p-2');
    expect(cn('text-red-500', 'p-2', 'text-blue-500')).not.toContain('text-red-500');
  });

  it('empty input yields empty string', () => {
    expect(cn()).toBe('');
  });
});

describe('formatRelativeTime', () => {
  // Stable "now" so the relative buckets are deterministic. Vitest's
  // vi.useFakeTimers freezes Date.now to whatever we set.
  const NOW = new Date('2026-05-10T12:00:00Z').getTime();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('< 1 minute returns "방금 전"', () => {
    expect(formatRelativeTime(NOW - 30 * 1000)).toBe('방금 전');
    expect(formatRelativeTime(NOW)).toBe('방금 전');
  });

  it('< 60 minutes returns "{n}분 전"', () => {
    expect(formatRelativeTime(NOW - 1 * 60 * 1000)).toBe('1분 전');
    expect(formatRelativeTime(NOW - 5 * 60 * 1000)).toBe('5분 전');
    expect(formatRelativeTime(NOW - 59 * 60 * 1000)).toBe('59분 전');
  });

  it('< 24 hours returns "{n}시간 전"', () => {
    expect(formatRelativeTime(NOW - 1 * 60 * 60 * 1000)).toBe('1시간 전');
    expect(formatRelativeTime(NOW - 23 * 60 * 60 * 1000)).toBe('23시간 전');
  });

  it('< 7 days returns "{n}일 전"', () => {
    expect(formatRelativeTime(NOW - 1 * 24 * 60 * 60 * 1000)).toBe('1일 전');
    expect(formatRelativeTime(NOW - 6 * 24 * 60 * 60 * 1000)).toBe('6일 전');
  });

  it('>= 7 days returns formatted absolute date', () => {
    // Falls through to toLocaleString('ko-KR') — exact format
    // depends on Node ICU, so we check it's not the relative form.
    const result = formatRelativeTime(NOW - 8 * 24 * 60 * 60 * 1000);
    expect(result).not.toMatch(/일 전$/);
    expect(result).not.toMatch(/시간 전$/);
    expect(result).not.toMatch(/분 전$/);
    expect(result).not.toBe('방금 전');
  });

  it('boundary at exactly 1 minute switches to minute bucket', () => {
    // 60_000 ms exactly — Math.floor(60000/60000)=1 → "1분 전",
    // not "방금 전". Off-by-one would put it on the wrong side.
    expect(formatRelativeTime(NOW - 60 * 1000)).toBe('1분 전');
  });

  it('boundary at exactly 1 hour switches to hour bucket', () => {
    expect(formatRelativeTime(NOW - 60 * 60 * 1000)).toBe('1시간 전');
  });

  it('boundary at exactly 24 hours switches to day bucket', () => {
    expect(formatRelativeTime(NOW - 24 * 60 * 60 * 1000)).toBe('1일 전');
  });
});
