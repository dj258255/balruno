/**
 * REST API client — Balruno backend.
 *
 * 책임:
 *  - 환경변수(NEXT_PUBLIC_API_URL) + serverUrl 우선순위 결정
 *  - Authorization 헤더 자동 첨부 (authStore 의 accessToken)
 *  - 401 응답 시 refresh token 으로 재시도 (1회만)
 *  - 표준 에러 (ApiError) 로 throw
 *
 * 사용 예:
 *   const me = await api.get<User>('/api/auth/me');
 *   await api.post('/api/projects', { name: '...' });
 *
 * 백엔드 endpoint 명세: docs/backend/04-api-spec.md
 */

import { useAuthStore } from '@/stores/authStore';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public payload?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestOptions extends Omit<RequestInit, 'body' | 'headers'> {
  body?: unknown;
  headers?: Record<string, string>;
  /** Skip Authorization 헤더 (로그인/회원가입 등) */
  noAuth?: boolean;
  /** 401 자동 refresh 비활성화 (refresh 자체 호출 시) */
  noRetry?: boolean;
}

function resolveBaseUrl(): string {
  // authStore.serverUrl 가 우선 (사용자 직접 설정), 없으면 env
  const stored = useAuthStore.getState().serverUrl;
  return stored || process.env.NEXT_PUBLIC_API_URL || '';
}

function buildHeaders(opts: RequestOptions): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...opts.headers,
  };
  if (!opts.noAuth) {
    const token = useAuthStore.getState().accessToken;
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  const payload = text ? safeJson(text) : null;

  if (!res.ok) {
    const code =
      (payload && typeof payload === 'object' && 'code' in payload && typeof payload.code === 'string')
        ? payload.code
        : `HTTP_${res.status}`;
    const message =
      (payload && typeof payload === 'object' && 'message' in payload && typeof payload.message === 'string')
        ? payload.message
        : res.statusText;
    throw new ApiError(res.status, code, message, payload);
  }
  return payload as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function tryRefresh(): Promise<boolean> {
  const refreshToken = useAuthStore.getState().refreshToken;
  if (!refreshToken) return false;

  try {
    const res = await rawRequest<{ accessToken: string; refreshToken?: string }>(
      'POST',
      '/api/auth/refresh',
      { body: { refreshToken }, noAuth: true, noRetry: true },
    );
    useAuthStore.getState().setTokens(res.accessToken, res.refreshToken ?? refreshToken);
    return true;
  } catch {
    useAuthStore.getState().logout();
    return false;
  }
}

async function rawRequest<T>(
  method: string,
  path: string,
  opts: RequestOptions = {},
): Promise<T> {
  const baseUrl = resolveBaseUrl();
  if (!baseUrl) {
    throw new ApiError(0, 'NO_BACKEND', '백엔드 URL 미설정 — .env 의 NEXT_PUBLIC_API_URL 또는 설정에서 server URL 입력');
  }
  const url = path.startsWith('http') ? path : `${baseUrl.replace(/\/$/, '')}${path}`;
  const { body, headers: _headers, noAuth: _noAuth, noRetry: _noRetry, ...rest } = opts;
  const init: RequestInit = {
    method,
    headers: buildHeaders(opts),
    credentials: 'include',
    ...rest,
  };
  if (body !== undefined) {
    init.body = typeof body === 'string' ? body : JSON.stringify(body);
  }

  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (e) {
    throw new ApiError(0, 'NETWORK', e instanceof Error ? e.message : 'network error');
  }

  if (res.status === 401 && !opts.noRetry && !opts.noAuth) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      return rawRequest<T>(method, path, { ...opts, noRetry: true });
    }
  }
  return handleResponse<T>(res);
}

export const api = {
  get: <T>(path: string, opts?: RequestOptions) => rawRequest<T>('GET', path, opts),
  post: <T>(path: string, opts?: RequestOptions) => rawRequest<T>('POST', path, opts),
  put: <T>(path: string, opts?: RequestOptions) => rawRequest<T>('PUT', path, opts),
  patch: <T>(path: string, opts?: RequestOptions) => rawRequest<T>('PATCH', path, opts),
  delete: <T>(path: string, opts?: RequestOptions) => rawRequest<T>('DELETE', path, opts),
};

/** 백엔드 연결 가능 여부 */
export function isBackendConfigured(): boolean {
  return !!resolveBaseUrl();
}
