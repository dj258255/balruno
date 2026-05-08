'use client';

/**
 * Anonymous-demo banner (ADR 0035). Renders only when the current
 * session is bound to the seeded demo user — i.e. someone landed
 * on `balruno.com/` while logged-out and got redirected onto the
 * shared playground.
 *
 * Mounted once at the root layout next to the Toaster so the banner
 * is visible on every demo route (project page, sheet, etc.) without
 * each page re-implementing it. Users who sign in cross the
 * authenticated branch in the auth store and the banner unmounts.
 */

import Link from 'next/link';
import { LogIn } from 'lucide-react';

import { useBackendAuthStore } from '@/stores/backendAuthStore';

const ANONYMOUS_USER_ID = '00000000-0000-0000-0000-0000000d3000';

export function AnonymousDemoBanner() {
  const user = useBackendAuthStore((s) => s.user);
  if (!user || user.id !== ANONYMOUS_USER_ID) return null;

  return (
    <div
      className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2 flex items-center gap-3 rounded-full border px-4 py-2 text-sm shadow-md backdrop-blur"
      style={{
        background: 'var(--bg-elevated)',
        borderColor: 'var(--border-primary)',
        color: 'var(--text-secondary)',
      }}
    >
      <span>
        익명 데모를 편집 중입니다. 로그인하면 내 워크스페이스에 저장돼요.
      </span>
      <Link
        href="/login"
        className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium"
        style={{ background: 'var(--text-primary)', color: 'var(--bg-primary)' }}
      >
        <LogIn className="h-3.5 w-3.5" /> 로그인
      </Link>
    </div>
  );
}
