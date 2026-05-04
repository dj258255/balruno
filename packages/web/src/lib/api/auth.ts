/**
 * Auth REST API client.
 * Endpoints: docs/backend/04-api-spec.md v1.1 §2.
 */

import { api } from './client';
import { useAuthStore, type User } from '@/stores/authStore';

interface LoginResponse {
  user: User;
  accessToken: string;
}

interface SignupBody {
  email: string;
  password: string;
  displayName: string;
  agreeTerms: boolean;
  agreePrivacy: boolean;
  agreeMarketing?: boolean;
}

export const authApi = {
  signup: (body: SignupBody) =>
    api.post<LoginResponse>('/api/auth/signup', { body, noAuth: true }),

  login: (email: string, password: string) =>
    api.post<LoginResponse>('/api/auth/login', { body: { email, password }, noAuth: true }),

  logout: () => api.post<void>('/api/auth/logout'),

  refresh: (refreshToken: string) =>
    api.post<{ accessToken: string; refreshToken?: string }>('/api/auth/refresh', {
      body: { refreshToken },
      noAuth: true,
      noRetry: true,
    }),

  forgotPassword: (email: string) =>
    api.post<{ ok: true }>('/api/auth/forgot-password', { body: { email }, noAuth: true }),

  resetPassword: (token: string, newPassword: string) =>
    api.post<void>('/api/auth/reset-password', { body: { token, newPassword }, noAuth: true }),

  verifyEmail: (token: string) =>
    api.get<{ verified: true }>(`/api/auth/verify-email?token=${encodeURIComponent(token)}`, { noAuth: true }),

  resendVerification: () => api.post<void>('/api/auth/resend-verification'),

  me: () => api.get<User>('/api/auth/me'),
};

/** Persist tokens + user to authStore after a successful login/signup response. */
export function applyLoginResponse(res: LoginResponse): void {
  useAuthStore.getState().setUser(res.user);
  useAuthStore.getState().setTokens(res.accessToken);
}
