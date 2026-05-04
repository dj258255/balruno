/**
 * Presence store — keyed by scope (sheet:<id> or doc:<id>).
 *
 * Sync hooks (useSheetCellSync / useDocYjsCloudSync) push remote presence
 * updates here; UI components read via useActiveUsers(scope).
 */

import { create } from 'zustand';

export interface PresenceUser {
  userId: string;
  displayName: string;
  color: string;
  /** Cell focus, when relevant (sheet scope). */
  cellKey?: { rowId: string; columnId: string };
  /** Cursor position in viewport coords (any scope). */
  cursor?: { x: number; y: number };
  /** True when the entry represents the local client. */
  isSelf?: boolean;
  lastSeen?: number;
}

type ScopeKey = string; // "sheet:<id>" | "doc:<id>"

interface PresenceState {
  byScope: Record<ScopeKey, Map<string, PresenceUser>>;

  upsert: (scope: ScopeKey, user: PresenceUser) => void;
  remove: (scope: ScopeKey, userId: string) => void;
  clearScope: (scope: ScopeKey) => void;
}

export const usePresenceStore = create<PresenceState>((set) => ({
  byScope: {},

  upsert: (scope, user) =>
    set((state) => {
      const next = new Map(state.byScope[scope] ?? new Map<string, PresenceUser>());
      next.set(user.userId, { ...user, lastSeen: Date.now() });
      return { byScope: { ...state.byScope, [scope]: next } };
    }),

  remove: (scope, userId) =>
    set((state) => {
      const existing = state.byScope[scope];
      if (!existing || !existing.has(userId)) return state;
      const next = new Map(existing);
      next.delete(userId);
      return { byScope: { ...state.byScope, [scope]: next } };
    }),

  clearScope: (scope) =>
    set((state) => {
      if (!state.byScope[scope]) return state;
      const { [scope]: _, ...rest } = state.byScope;
      return { byScope: rest };
    }),
}));
