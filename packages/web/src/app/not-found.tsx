'use client';

import Link from 'next/link';
import { Compass } from 'lucide-react';

export default function NotFound() {
  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center px-4 text-center"
      style={{ background: 'var(--bg-secondary)' }}
    >
      <Compass className="w-12 h-12 mb-4" style={{ color: 'var(--text-tertiary)' }} />
      <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
        404 — Not Found
      </h1>
      <p className="mb-6 max-w-sm text-sm" style={{ color: 'var(--text-secondary)' }}>
        요청하신 페이지를 찾을 수 없습니다. 이동된 페이지일 수 있어요.
      </p>
      <Link
        href="/"
        className="px-4 py-2 rounded-md font-medium"
        style={{ background: 'var(--accent)', color: '#fff' }}
      >
        홈으로
      </Link>
    </main>
  );
}
