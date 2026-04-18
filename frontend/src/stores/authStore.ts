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
      setUser: (user) =>
        set({
          user,
          isAuthenticated: !!user,
        }),

      setTokens: (accessToken, refreshToken) =>
        set({
          accessToken,
          refreshToken: refreshToken ?? null,
          isAuthenticated: !!accessToken,
        }),

      setServerUrl: (url) =>
        set({
          serverUrl: url,
        }),

      logout: () =>
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
        }),
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
