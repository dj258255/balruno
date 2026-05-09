/**
 * BackendError unit tests covering the ProblemDetail parsing +
 * convenience getters that callers depend on (isQuotaExceeded /
 * quotaInfo / isUnauthenticated / fields).
 */
import { describe, it, expect } from 'vitest';
import { BackendError, type ProblemDetail } from './client';

describe('BackendError', () => {
  describe('basic shape', () => {
    it('uses ProblemDetail.detail as message when present', () => {
      const err = new BackendError(400, { detail: 'slug taken' }, 'Bad Request');
      expect(err.message).toBe('slug taken');
    });

    it('falls back to title when detail absent', () => {
      const err = new BackendError(400, { title: 'Bad Request' }, 'fallback');
      expect(err.message).toBe('Bad Request');
    });

    it('falls back to fallbackMessage when both detail and title absent', () => {
      const err = new BackendError(500, null, 'network down');
      expect(err.message).toBe('network down');
    });

    it('synthesizes code when ProblemDetail omits one', () => {
      // HTTP_<status> shape lets callers branch on numeric class even
      // for backends that haven't adopted ProblemDetail's `code` field.
      const err = new BackendError(503, null, 'unavailable');
      expect(err.code).toBe('HTTP_503');
    });

    it('preserves provided code from ProblemDetail body', () => {
      const err = new BackendError(409, { code: 'SLUG_TAKEN' }, 'Conflict');
      expect(err.code).toBe('SLUG_TAKEN');
    });

    it('exposes traceId for log correlation', () => {
      const err = new BackendError(500, { traceId: 'abc-123' }, 'oops');
      expect(err.traceId).toBe('abc-123');
    });

    it('exposes field-level errors for VALIDATION_FAILED', () => {
      const fields = [{ field: 'slug', message: 'too short' }];
      const err = new BackendError(400, {
        code: 'VALIDATION_FAILED',
        errors: fields,
      }, 'Bad Request');
      expect(err.fields).toEqual(fields);
    });

    it('preserves raw body for richer surfaces', () => {
      const body: ProblemDetail = { code: 'X', detail: 'y' };
      const err = new BackendError(400, body, 'fallback');
      expect(err.body).toBe(body);
    });
  });

  describe('isUnauthenticated', () => {
    it('true on 401', () => {
      const err = new BackendError(401, null, '');
      expect(err.isUnauthenticated).toBe(true);
    });

    it('false on other statuses', () => {
      expect(new BackendError(403, null, '').isUnauthenticated).toBe(false);
      expect(new BackendError(500, null, '').isUnauthenticated).toBe(false);
    });
  });

  describe('isForbidden', () => {
    it('true on 403', () => {
      expect(new BackendError(403, null, '').isForbidden).toBe(true);
    });

    it('false on 401', () => {
      // 401 != 403 — different remediation (re-auth vs upgrade-role).
      expect(new BackendError(401, null, '').isForbidden).toBe(false);
    });
  });

  describe('isQuotaExceeded', () => {
    it('true when code === QUOTA_EXCEEDED', () => {
      const err = new BackendError(403, { code: 'QUOTA_EXCEEDED' }, '');
      expect(err.isQuotaExceeded).toBe(true);
    });

    it('false when code differs', () => {
      const err = new BackendError(403, { code: 'INSUFFICIENT_ROLE' }, '');
      expect(err.isQuotaExceeded).toBe(false);
    });

    it('false on quota-shaped status without the code', () => {
      // Not every 403 is a quota. The code field is the canonical
      // signal — defensive against naming drift.
      const err = new BackendError(403, null, '');
      expect(err.isQuotaExceeded).toBe(false);
    });
  });

  describe('quotaInfo', () => {
    it('returns typed quota extras when all four fields present', () => {
      const err = new BackendError(403, {
        code: 'QUOTA_EXCEEDED',
        quotaKey: 'projectsPerWorkspace',
        current: 3,
        limit: 3,
        plan: 'FREE',
      } as ProblemDetail, '');

      expect(err.quotaInfo()).toEqual({
        key: 'projectsPerWorkspace',
        current: 3,
        limit: 3,
        plan: 'FREE',
      });
    });

    it('returns null when not a quota error', () => {
      const err = new BackendError(403, { code: 'OTHER' }, '');
      expect(err.quotaInfo()).toBeNull();
    });

    it('returns null when quotaKey missing from body', () => {
      // Defensive — backend should always send all four fields with
      // QUOTA_EXCEEDED, but a malformed response shouldn't crash UI.
      const err = new BackendError(403, {
        code: 'QUOTA_EXCEEDED',
        current: 3,
        limit: 3,
        plan: 'FREE',
      } as ProblemDetail, '');
      expect(err.quotaInfo()).toBeNull();
    });

    it('returns null when current is missing', () => {
      const err = new BackendError(403, {
        code: 'QUOTA_EXCEEDED',
        quotaKey: 'k',
        limit: 3,
        plan: 'FREE',
      } as ProblemDetail, '');
      expect(err.quotaInfo()).toBeNull();
    });

    it('treats current=0 as valid quota info, not missing', () => {
      // The == null check distinguishes 0 (valid) from undefined.
      // First-mutation rejection has current=0 and we want the rich
      // toast, not the fallback.
      const err = new BackendError(403, {
        code: 'QUOTA_EXCEEDED',
        quotaKey: 'k',
        current: 0,
        limit: 0,
        plan: 'FREE',
      } as ProblemDetail, '');
      expect(err.quotaInfo()).toEqual({
        key: 'k',
        current: 0,
        limit: 0,
        plan: 'FREE',
      });
    });
  });

  it('extends Error with name "BackendError"', () => {
    const err = new BackendError(500, null, '');
    expect(err.name).toBe('BackendError');
    expect(err).toBeInstanceOf(Error);
  });
});
