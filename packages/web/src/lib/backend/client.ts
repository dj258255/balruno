/**
 * Balruno backend HTTP client.
 *
 * Browser auth flows on the httpOnly `balruno_session` cookie set by the
 * backend after OAuth login, so the client just sends `credentials:
 * 'include'` and lets the browser ferry the cookie. Bearer tokens
 * (Electron, future CLI) can be supplied per-call via the `bearer`
 * option.
 *
 * Errors land as {@link BackendError} with the RFC 7807 ProblemDetail
 * fields parsed out — `code` (app-level enum), `traceId` (X-Request-Id
 * echo), `errors` (field-level array on validation failure).
 */

// No hard-coded default — leaving the prod URL in here would mean a fork
// of this repo would, until rebuilt, ship pointing at the upstream
// hosted SaaS. Set NEXT_PUBLIC_BALRUNO_API_URL in your deploy
// environment (Vercel → Project Settings → Environment Variables, or
// .env.local for `pnpm dev`). When unset, BASE_URL is empty and
// {@link isBackendConfigured} returns false — sync hooks and the
// workspace-list bootstrap silently no-op so a self-host operator who
// forgot to set the env at least gets a working local-only build.
// Next.js inlines NEXT_PUBLIC_* at build time. The hardcoded fallback
// is the upstream Balruno SaaS host so the deployed bundle keeps
// working even when this module is consumed from a chunk where the
// env literal didn't make it through turbopack's module graph (the
// pure `?? ''` form intermittently evaluated empty in production
// despite a sibling chunk inlining the literal correctly). Self-host
// operators override via NEXT_PUBLIC_BALRUNO_API_URL in their deploy
// env (Vercel project / .env.local / OSS fork's CI) — the fallback
// only kicks in when nothing is set, in which case landing on
// upstream prod is acceptable for diagnostics.
const BASE_URL =
  process.env.NEXT_PUBLIC_BALRUNO_API_URL || 'https://api.balruno.com';

export interface ProblemDetail {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  instance?: string;
  /** Application-level enum-like code (e.g. UNAUTHENTICATED, SLUG_TAKEN). */
  code?: string;
  /** X-Request-Id of the failing request. */
  traceId?: string;
  /** Field-level errors when code === VALIDATION_FAILED. */
  errors?: Array<{ field: string; message: string }>;
}

export class BackendError extends Error {
  readonly status: number;
  readonly code: string;
  readonly traceId?: string;
  readonly fields?: Array<{ field: string; message: string }>;

  constructor(status: number, body: ProblemDetail | null, fallbackMessage: string) {
    super(body?.detail ?? body?.title ?? fallbackMessage);
    this.name = 'BackendError';
    this.status = status;
    this.code = body?.code ?? `HTTP_${status}`;
    this.traceId = body?.traceId;
    this.fields = body?.errors;
  }

  /** True for 401 responses — caller should redirect to OAuth login. */
  get isUnauthenticated(): boolean {
    return this.status === 401;
  }

  /** True for 403 responses — caller lacks permission for the action. */
  get isForbidden(): boolean {
    return this.status === 403;
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  /** When provided, sets Authorization: Bearer instead of relying on cookies. */
  bearer?: string;
  /** Override the X-Request-Id (otherwise the server mints one). */
  requestId?: string;
  /** Skip the credentials: include behaviour (rarely needed). */
  noCookie?: boolean;
}

export async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const url = path.startsWith('http') ? path : `${BASE_URL.replace(/\/$/, '')}${path}`;
  const headers: Record<string, string> = {
    Accept: 'application/json, application/problem+json',
  };
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (opts.bearer) headers['Authorization'] = `Bearer ${opts.bearer}`;
  if (opts.requestId) headers['X-Request-Id'] = opts.requestId;

  const init: RequestInit = {
    method: opts.method ?? 'GET',
    headers,
    credentials: opts.noCookie ? 'omit' : 'include',
  };
  if (opts.body !== undefined) {
    init.body = typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body);
  }

  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (e) {
    throw new BackendError(0, null, e instanceof Error ? e.message : 'network error');
  }

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const body = text ? safeJson(text) : null;

  if (!res.ok) {
    throw new BackendError(res.status, body as ProblemDetail | null, res.statusText);
  }
  return body as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** Backend base URL — useful for constructing OAuth redirect targets. */
export function backendBaseUrl(): string {
  return BASE_URL.replace(/\/$/, '');
}

/**
 * Whether a backend URL is configured. Sync hooks + status indicators
 * use this to silently no-op in offline / preview builds rather than
 * spamming the network with failed requests.
 */
export function isBackendConfigured(): boolean {
  return Boolean(BASE_URL);
}
