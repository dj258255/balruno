/**
 * Backend auth state — tracks the user identified by the
 * `balruno_session` cookie. Separate from the local-mode authStore
 * (which still drives offline projects); this one is authoritative when
 * the app talks to the real backend.
 *
 * Lifecycle:
 *   - status starts 'idle'
 *   - bootstrap() flips to 'loading', then 'authenticated' or 'anonymous'
 *   - clear() flips to 'anonymous' (used after logout / token expiry)
 *
 * The cookie itself is httpOnly and not visible from JavaScript — this
 * store only mirrors the result of /api/v1/me.
 */

import { create } from 'zustand';

import type { AuthenticatedUser } from '@/lib/backend';
import { fetchCurrentUser } from '@/lib/backend';

export type BackendAuthStatus = 'idle' | 'loading' | 'authenticated' | 'anonymous';

interface BackendAuthState {
  user: AuthenticatedUser | null;
  status: BackendAuthStatus;
  /**
   * Last error from a bootstrap attempt — null on success / non-401
   * errors are stashed here for the UI to surface a retry banner.
   */
  error: string | null;

  bootstrap: () => Promise<void>;
  clear: () => void;
  setUser: (user: AuthenticatedUser | null) => void;
}

// In-flight bootstrap promise — module-level so concurrent callers
// (root-layout BackendAuthBootstrap + /auth/callback page useEffect)
// share the same /api/v1/me request and the same final status. The
// previous implementation only had `if (status === 'loading') return`,
// which let the second caller proceed immediately and read status
// while the first call's fetch was still in flight, observing
// 'loading' instead of the eventual 'authenticated' and redirecting
// to /login?status=error.
let inflight: Promise<void> | null = null;

export const useBackendAuthStore = create<BackendAuthState>((set) => ({
  user: null,
  status: 'idle',
  error: null,

  bootstrap: async () => {
    if (inflight) return inflight;
    inflight = (async () => {
      set({ status: 'loading', error: null });
      try {
        const user = await fetchCurrentUser();
        set({
          user,
          status: user ? 'authenticated' : 'anonymous',
        });
      } catch (e) {
        set({
          status: 'anonymous',
          error: e instanceof Error ? e.message : 'Failed to load session.',
        });
      } finally {
        inflight = null;
      }
    })();
    return inflight;
  },

  clear: () => set({ user: null, status: 'anonymous', error: null }),
  setUser: (user) =>
    set({
      user,
      status: user ? 'authenticated' : 'anonymous',
    }),
}));
