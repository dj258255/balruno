/**
 * 에러 리포팅 어댑터 — Sentry/PostHog/LogRocket 연동 준비.
 *
 * 현재는 no-op (콘솔 로그만 + localStorage 50개 보관).
 * Sentry 활성화는 **2 스텝**:
 *   1. `npm i @sentry/nextjs`
 *   2. `NEXT_PUBLIC_SENTRY_DSN` 환경변수 설정
 *   → 앱 로드 시 `initErrorReporting()` 가 자동 감지해서 init.
 *
 * 컴포넌트/바운더리가 `reportError(err)` 호출만 하면 Sentry / console / localStorage
 * 어디로 갈지 결정은 이 파일이 일원화.
 */

export interface ErrorContext {
  /** 소스 레이블 (예: 'app-error', 'global-error', 'panel-crash') */
  source: string;
  /** 사용자 id (익명 기본) */
  userId?: string;
  /** 추가 메타 */
  extra?: Record<string, unknown>;
}

let initialized = false;
let sentryAvailable = false;

/**
 * 환경변수 `NEXT_PUBLIC_SENTRY_DSN` 이 설정돼 있으면 Sentry 를 동적 import 로 초기화.
 * 미설치 시 graceful no-op (try/catch).
 * 앱 entry (layout.tsx 또는 page.tsx) 에서 1회 호출.
 */
export async function initErrorReporting(dsn?: string): Promise<void> {
  if (initialized) return;
  const effectiveDsn = dsn ?? (typeof process !== 'undefined'
    ? process.env.NEXT_PUBLIC_SENTRY_DSN
    : undefined);
  if (!effectiveDsn) {
    initialized = true;
    return;
  }

  try {
    const sentry = await import('@sentry/nextjs');
    sentry.init({
      dsn: effectiveDsn,
      tracesSampleRate: 0.1,
      environment: typeof process !== 'undefined' ? process.env.NODE_ENV : 'production',
    });
    sentryAvailable = true;
    console.info('[errorReporting] Sentry 초기화 완료');
  } catch (e) {
    // @sentry/nextjs 미설치 — no-op 로 fallback
    console.warn('[errorReporting] Sentry 패키지 없음. `npm i @sentry/nextjs` 필요.');
    void e;
  }
  initialized = true;
}

export function reportError(error: Error | unknown, context: ErrorContext): void {
  const err = error instanceof Error ? error : new Error(String(error));
  // 1) 콘솔 (개발 + 보조)
  console.error(`[${context.source}]`, err, context.extra);

  // 2) Sentry — 설치/DSN 설정된 경우에만
  if (sentryAvailable) {
    (async () => {
      try {
        const sentry = await import('@sentry/nextjs');
        sentry.withScope((scope: unknown) => {
          const s = scope as { setTag: (k: string, v: string) => void; setUser: (u: unknown) => void; setContext: (k: string, v: unknown) => void };
          s.setTag('source', context.source);
          if (context.userId) s.setUser({ id: context.userId });
          if (context.extra) s.setContext('extra', context.extra);
          sentry.captureException(err);
        });
      } catch {
        // ignore
      }
    })();
  }

  // 3) 로컬 저장 — 오프라인 재전송용 (최근 50개)
  try {
    if (typeof window === 'undefined') return;
    const key = 'balruno:error-log';
    const raw = localStorage.getItem(key);
    const list = raw ? (JSON.parse(raw) as unknown[]) : [];
    list.unshift({
      timestamp: Date.now(),
      source: context.source,
      message: err.message,
      stack: err.stack?.split('\n').slice(0, 5).join('\n'),
      extra: context.extra,
    });
    localStorage.setItem(key, JSON.stringify(list.slice(0, 50)));
  } catch {
    // 쿼터 초과 등 — 무시
  }
}

/** 개발자/관리자가 최근 에러 확인 */
export function getRecentErrors(): unknown[] {
  try {
    if (typeof window === 'undefined') return [];
    const raw = localStorage.getItem('balruno:error-log');
    return raw ? (JSON.parse(raw) as unknown[]) : [];
  } catch {
    return [];
  }
}

export function clearErrorLog(): void {
  try {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('balruno:error-log');
  } catch {
    // ignore
  }
}
