/**
 * 에러 리포팅 어댑터 — tagged reportError 진입점.
 *
 * Sentry SDK init 은 `instrumentation-client.ts` (Next.js 16 / @sentry/nextjs v10
 * 권장 path) 에서 한 번 처리. 이 파일은 *tagged report* 만 담당:
 *   - console
 *   - Sentry.captureException (전역 init 끝나 있을 때 자동 동작)
 *   - localStorage 최근 50건 (오프라인 재전송용)
 *
 * `initErrorReporting()` 는 호환성 stub — 호출해도 무해 (이미 init 된 상태).
 */

import { kvStorage } from './kvStorage';

export interface ErrorContext {
  /** 소스 레이블 (예: 'app-error', 'global-error', 'panel-crash') */
  source: string;
  /** 사용자 id (익명 기본) */
  userId?: string;
  /** 추가 메타 */
  extra?: Record<string, unknown>;
}

const sentryAvailable = typeof process !== 'undefined'
  && !!process.env.NEXT_PUBLIC_SENTRY_DSN;

/**
 * Compatibility shim — Sentry SDK 의 init 은 instrumentation-client.ts
 * 가 *앱 부팅 시* 한 번 처리하므로 이 함수는 no-op 으로 유지.
 * 기존 호출 site (`app/page.tsx` 의 `initErrorReporting()`) 는 그대로 두고
 * 점진 정리.
 */
export async function initErrorReporting(_dsn?: string): Promise<void> {
  void _dsn;
  // no-op — kept so existing call sites don't break.
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
    const key = 'balruno:error-log';
    const raw = kvStorage.get(key);
    const list = raw ? (JSON.parse(raw) as unknown[]) : [];
    list.unshift({
      timestamp: Date.now(),
      source: context.source,
      message: err.message,
      stack: err.stack?.split('\n').slice(0, 5).join('\n'),
      extra: context.extra,
    });
    kvStorage.set(key, JSON.stringify(list.slice(0, 50)));
  } catch {
    // 쿼터 초과 등 — 무시
  }
}

