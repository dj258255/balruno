import { request, BackendError } from './client';
import type { AuthenticatedUser } from './types';

/**
 * Fetches the currently authenticated user via the cookie that the
 * OAuth callback set. Returns null on 401 (caller can redirect to
 * login); other errors propagate.
 */
export async function fetchCurrentUser(): Promise<AuthenticatedUser | null> {
  try {
    return await request<AuthenticatedUser>('/api/v1/me');
  } catch (e) {
    if (e instanceof BackendError && e.isUnauthenticated) return null;
    throw e;
  }
}
