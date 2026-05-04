/**
 * 인증 상태 관리 Store
 * 클라우드 모드에서 사용자 인증 정보 관리
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface User {
  id: string;
  email: string;
  name: string;
}

interface AuthState {
  // 상태
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;

  // 클라우드 서버 설정
  serverUrl: string | null;

  // 액션
  setUser: (user: User | null) => void;
  setTokens: (accessToken: string | null, refreshToken?: string | null) => void;
  setServerUrl: (url: string | null) => void;
  logout: () => void;
}

/** Lightweight cookie used by middleware.ts to gate routes. Bool flag only — no secret. */
function writeAuthCookie(authed: boolean) {
  if (typeof document === 'undefined') return;
  if (authed) {
    document.cookie = 'balruno-authed=1; Path=/; Max-Age=2592000; SameSite=Lax';
  } else {
    document.cookie = 'balruno-authed=; Path=/; Max-Age=0; SameSite=Lax';
  }
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      // 초기 상태
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      serverUrl: null,

      // 액션
      setUser: (user) => {
        writeAuthCookie(!!user);
        set({
          user,
          isAuthenticated: !!user,
        });
      },

      setTokens: (accessToken, refreshToken) => {
        writeAuthCookie(!!accessToken);
        set({
          accessToken,
          refreshToken: refreshToken ?? null,
          isAuthenticated: !!accessToken,
        });
      },

      setServerUrl: (url) =>
        set({
          serverUrl: url,
        }),

      logout: () => {
        writeAuthCookie(false);
        // Linear model: server is canonical, client is cache. Drop all cached data on logout
        // so the next user on the same device can't see the previous user's projects.
        if (typeof window !== 'undefined') {
          // Wipe Y.Doc IndexedDB stores (project Y.Docs persisted by y-indexeddb).
          if (window.indexedDB) {
            void window.indexedDB.databases?.().then((dbs) => {
              for (const db of dbs) {
                if (db.name && db.name.startsWith('balruno-ydoc-')) {
                  window.indexedDB.deleteDatabase(db.name);
                }
              }
            });
          }
          // Wipe persistent zustand stores keyed under balruno-* (project state, sidebar prefs, etc.)
          // except the auth key, which we reset below.
          try {
            for (let i = window.localStorage.length - 1; i >= 0; i--) {
              const key = window.localStorage.key(i);
              if (key && key.startsWith('balruno-') && key !== 'balruno-auth') {
                window.localStorage.removeItem(key);
              }
            }
          } catch {
            // localStorage unavailable (private mode) — ignore.
          }
        }
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
        });
      },
    }),
    {
      name: 'balruno-auth',
      partialize: (state) => ({
        // 민감한 정보는 저장하지 않거나, 암호화 필요
        serverUrl: state.serverUrl,
        // accessToken은 보안상 sessionStorage나 메모리에만 저장하는 것이 좋음
        // 여기서는 편의상 localStorage에 저장
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
      }),
    }
  )
);
