/**
 * Workspace list cache — server-canonical (Linear 모델, ADR 0003).
 *
 * The sidebar's workspace switcher used to read a hard-coded
 * `[{id:'default'}]` array out of `useSidebarPrefs`; this store replaces
 * that with the real `listWorkspaces()` response. The list is kept
 * client-side only as a cache: on bootstrap it fetches once, on
 * `refresh()` it re-fetches, and create/rename mutations call the
 * backend then refresh.
 *
 * The active-workspace id continues to live in `useSidebarPrefs` (it's a
 * UI preference, persisted across reloads). After bootstrap this store
 * reconciles: if the persisted active id isn't in the user's list — or
 * is the legacy `'default'` placeholder — it falls back to the first
 * server workspace so the sidebar always points at something real.
 */

import { create } from 'zustand';

import {
  BackendError,
  listWorkspaces,
  updateWorkspace,
  type Workspace,
} from '@/lib/backend';
import { useSidebarPrefs } from '@/stores/sidebarPrefsStore';

export type WorkspaceListStatus = 'idle' | 'loading' | 'ready' | 'error';

interface WorkspaceListState {
  workspaces: Workspace[];
  status: WorkspaceListStatus;
  /** Last error from a fetch — null on success / 401. */
  error: string | null;

  /** First-time fetch. Idempotent: re-entering during {@code loading} is a no-op. */
  bootstrap: () => Promise<void>;
  /** Force a re-fetch (used after create / delete / role changes). */
  refresh: () => Promise<void>;
  /** Rename via {@link updateWorkspace} then refresh the cache. */
  rename: (id: string, name: string) => Promise<void>;

  /** Reset to idle on logout. */
  clear: () => void;
}

export const useWorkspaceListStore = create<WorkspaceListState>((set, get) => ({
  workspaces: [],
  status: 'idle',
  error: null,

  bootstrap: async () => {
    if (get().status === 'loading' || get().status === 'ready') return;
    await fetchAndReconcile(set);
  },

  refresh: async () => {
    await fetchAndReconcile(set);
  },

  rename: async (id, name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    await updateWorkspace(id, { name: trimmed });
    await fetchAndReconcile(set);
  },

  clear: () => set({ workspaces: [], status: 'idle', error: null }),
}));

async function fetchAndReconcile(
  set: (s: Partial<WorkspaceListState>) => void,
): Promise<void> {
  set({ status: 'loading', error: null });
  try {
    const workspaces = await listWorkspaces();
    set({ workspaces, status: 'ready' });
    reconcileActiveWorkspace(workspaces);
  } catch (e) {
    if (e instanceof BackendError && e.isUnauthenticated) {
      // Auth probe is the auth store's job; we just stay idle so we can
      // re-bootstrap after re-login without leaking a stale 401 toast.
      set({ workspaces: [], status: 'idle', error: null });
      return;
    }
    set({ status: 'error', error: e instanceof Error ? e.message : 'failed' });
  }
}

/**
 * Bridge from the server-fetched list to the persisted UI preference.
 * Runs after every successful fetch so newly-joined and newly-deleted
 * workspaces stay in sync.
 */
function reconcileActiveWorkspace(workspaces: Workspace[]): void {
  if (workspaces.length === 0) return;
  const prefs = useSidebarPrefs.getState();
  const current = prefs.activeWorkspaceId;
  const stillValid = workspaces.some((w) => w.id === current);
  if (!stillValid) {
    prefs.setActiveWorkspace(workspaces[0].id);
  }
}
