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

export interface UpdateProfileInput {
  /** Pass null / undefined to leave unchanged. Empty string is rejected. */
  name?: string;
  /** Pass null / undefined to leave unchanged. Empty string clears
   *  the avatar (back to OAuth default on next login). Otherwise must
   *  be a {@code /media/avatars/...} URL returned by uploadAvatar. */
  avatarUrl?: string;
}

/**
 * PATCH /api/v1/me — display name + avatar edit. Throws BackendError
 * with code === 'INVALID_PROFILE' on validation failure (empty name,
 * oversized field, avatarUrl outside the upload namespace).
 */
export function updateProfile(input: UpdateProfileInput): Promise<AuthenticatedUser> {
  return request<AuthenticatedUser>('/api/v1/me', {
    method: 'PATCH',
    body: input,
  });
}
