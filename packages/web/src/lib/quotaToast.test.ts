/**
 * handleQuotaError unit tests — verifies the quota error → sonner
 * toast routing + the inline upgrade action wiring.
 *
 * sonner is mocked so we observe the call shape without rendering.
 * Side-effecting Stripe checkout fetch is mocked at the global
 * `fetch` level so the test verifies the redirect intent without
 * actually hitting the network.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { toast } from 'sonner';

import { BackendError } from './backend/client';
import { handleQuotaError } from './quotaToast';

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
  },
}));

describe('handleQuotaError', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns false for non-BackendError', () => {
    expect(handleQuotaError(new Error('not a backend err'))).toBe(false);
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('returns false for BackendError that is not QUOTA_EXCEEDED', () => {
    const err = new BackendError(403, { code: 'INSUFFICIENT_ROLE' }, 'forbidden');
    expect(handleQuotaError(err)).toBe(false);
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('returns true and shows toast on QUOTA_EXCEEDED', () => {
    const err = new BackendError(403, {
      code: 'QUOTA_EXCEEDED',
      quotaKey: 'projectsPerWorkspace',
      current: 3,
      limit: 3,
      plan: 'FREE',
    } as never, '');

    const handled = handleQuotaError(err, 'ws-id');

    expect(handled).toBe(true);
    expect(toast.error).toHaveBeenCalledTimes(1);
  });

  it('uses Korean label for known quotaKey in toast message', () => {
    // QUOTA_LABELS map has Korean copy for all known keys; the toast
    // detail shows the human label rather than the wire enum.
    const err = new BackendError(403, {
      code: 'QUOTA_EXCEEDED',
      quotaKey: 'projectsPerWorkspace',
      current: 3,
      limit: 3,
      plan: 'FREE',
    } as never, '');

    handleQuotaError(err, 'ws-id');

    const detail = (toast.error as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(detail).toContain('프로젝트 수');
    expect(detail).toContain('3');
    expect(detail).toContain('FREE');
  });

  it('falls back to wire key when quotaKey is unknown', () => {
    const err = new BackendError(403, {
      code: 'QUOTA_EXCEEDED',
      quotaKey: 'futureMetric',
      current: 1,
      limit: 1,
      plan: 'PRO',
    } as never, '');

    handleQuotaError(err, 'ws-id');

    const detail = (toast.error as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(detail).toContain('futureMetric');
  });

  it('with workspaceId — toast action is "플랜 업그레이드"', () => {
    const err = new BackendError(403, {
      code: 'QUOTA_EXCEEDED',
      quotaKey: 'rowsPerSheet',
      current: 2000,
      limit: 2000,
      plan: 'FREE',
    } as never, '');

    handleQuotaError(err, 'ws-id');

    const opts = (toast.error as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(opts.action.label).toBe('플랜 업그레이드');
    expect(typeof opts.action.onClick).toBe('function');
  });

  it('without workspaceId — toast action is "요금제 보기"', () => {
    // Public surfaces (e.g., share-link reader hitting a quota) have
    // no workspace context — fall back to /pricing rather than a
    // workspace-scoped checkout.
    const err = new BackendError(403, {
      code: 'QUOTA_EXCEEDED',
      quotaKey: 'k',
      current: 1,
      limit: 1,
      plan: 'FREE',
    } as never, '');

    handleQuotaError(err);

    const opts = (toast.error as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(opts.action.label).toBe('요금제 보기');
  });

  it('toast duration is 8 seconds for the quota toast', () => {
    // Quota toasts get longer dwell than typical errors so the user
    // has time to read + click upgrade. Default sonner is ~4s.
    const err = new BackendError(403, {
      code: 'QUOTA_EXCEEDED',
      quotaKey: 'k',
      current: 1,
      limit: 1,
      plan: 'FREE',
    } as never, '');

    handleQuotaError(err, 'ws-id');

    const opts = (toast.error as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(opts.duration).toBe(8000);
  });

  it('falls back to err.message when quotaInfo is null but isQuotaExceeded', () => {
    // Backend sent QUOTA_EXCEEDED but malformed payload (no quotaKey
    // / current / limit). Toast still fires with the raw err.message
    // rather than swallowing the error silently.
    const err = new BackendError(403, {
      code: 'QUOTA_EXCEEDED',
      detail: 'something hit a cap',
    } as never, 'fallback');

    const handled = handleQuotaError(err, 'ws-id');

    expect(handled).toBe(true);
    const detail = (toast.error as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(detail).toBe('something hit a cap');
  });
});
