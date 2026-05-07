/**
 * Per-tab client session id (ADR 0021 v2.3 Phase 5 — Pattern C).
 *
 * Baserow's `ClientUndoRedoActionGroupId` HTTP header is the upstream
 * pattern. We use a tab-stable UUIDv4 from `localStorage` so all
 * emits + undo / redo REST calls from the same tab carry the same
 * id — server uses it to scope the Cmd+Z lookup to *just this tab*'s
 * actions.
 *
 * Why tab-stable (sessionStorage) won't do: across page refresh, the
 * tab keeps the same logical session. sessionStorage clears on
 * refresh. localStorage survives.
 *
 * Why per-*tab* not per-user: opening two tabs of the same project
 * should give two independent histories. Each tab sees its own
 * Cmd+Z stack — Baserow's quoted contract: "Undo/redo only works
 * for your own actions in your current browser session."
 *
 * Implementation: each tab generates its own UUID on first
 * mount, but localStorage is *per-origin* not per-tab. So we
 * combine: on first mount, generate UUID + store in
 * sessionStorage + add to localStorage list. Use sessionStorage
 * value (per-tab survives refresh, dies on tab close).
 */

const SESSION_KEY = 'balruno:client-session-id';

let cached: string | null = null;

/**
 * Get the current tab's session id, generating one on first call.
 * SSR-safe: returns a stable placeholder when window is undefined
 * (the actual call sites only fire after mount, so the placeholder
 * never reaches the wire). The placeholder is rejected by the
 * backend's UUID validator if it ever does, so the worst case is
 * a 400 response — preferable to a fake correlation that mixes
 * tabs.
 */
export function getClientSessionId(): string {
  if (cached) return cached;
  if (typeof window === 'undefined') {
    return '00000000-0000-4000-8000-000000000000';
  }
  const existing = window.sessionStorage.getItem(SESSION_KEY);
  if (existing) {
    cached = existing;
    return existing;
  }
  const fresh = crypto.randomUUID();
  window.sessionStorage.setItem(SESSION_KEY, fresh);
  cached = fresh;
  return fresh;
}

/** Test-only — drop the cached value so a new UUID is generated. */
export function __resetClientSessionIdForTests(): void {
  cached = null;
  if (typeof window !== 'undefined') {
    window.sessionStorage.removeItem(SESSION_KEY);
  }
}
