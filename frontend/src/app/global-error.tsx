'use client';

import { useEffect } from 'react';
import { reportError } from '@/lib/errorReporting';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportError(error, { source: 'global-error', extra: { digest: error.digest } });
  }, [error]);

  return (
    <html lang="ko">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Pretendard", "Segoe UI", sans-serif',
          backgroundColor: '#0a0a0a',
          color: '#fafafa',
          padding: '24px',
        }}
      >
        <div
          role="alert"
          aria-live="assertive"
          style={{
            maxWidth: 480,
            width: '100%',
            padding: 32,
            borderRadius: 12,
            backgroundColor: '#141414',
            border: '1px solid #262626',
          }}
        >
          <h1 style={{ fontSize: 20, fontWeight: 600, margin: '0 0 8px' }}>
            심각한 오류가 발생했어요
          </h1>
          <p
            style={{
              fontSize: 14,
              margin: '0 0 24px',
              color: '#a3a3a3',
              lineHeight: 1.6,
            }}
          >
            앱을 다시 불러와야 합니다. 브라우저에 저장된 프로젝트 데이터는 안전해요.
          </p>
          <button
            type="button"
            onClick={reset}
            aria-label="앱 다시 시작"
            style={{
              padding: '10px 16px',
              borderRadius: 8,
              border: 'none',
              backgroundColor: '#3b82f6',
              color: 'white',
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            앱 다시 시작
          </button>
        </div>
      </body>
    </html>
  );
}
