'use client';

/**
 * Current User 표시 — Stage 3 "Airtable current user 필터" 가시화.
 *
 * 모든 위젯에서 이 유저 이름 기준으로 "내 작업" 필터.
 * Track 8 Presence 의 user-name 을 재사용 (backend 오기 전 대체).
 * 클릭 시 SettingsModal 로 이동 → 이름/색 변경.
 */

import { useEffect, useState } from 'react';
import { User } from 'lucide-react';

function useCurrentUser() {
  const [name, setName] = useState<string>('local');
  const [color, setColor] = useState<string>('#3b82f6');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setName(localStorage.getItem('balruno:user-name') ?? 'local');
    setColor(localStorage.getItem('balruno:user-color') ?? '#3b82f6');

    // 다른 탭에서 변경되면 동기화
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'balruno:user-name') setName(e.newValue ?? 'local');
      if (e.key === 'balruno:user-color') setColor(e.newValue ?? '#3b82f6');
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  return { name, color };
}

export default function CurrentUserBadge() {
  const { name, color } = useCurrentUser();

  return (
    <button
      onClick={() => window.dispatchEvent(new Event('balruno:open-settings'))}
      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-caption hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
      style={{ background: 'var(--bg-secondary)' }}
      title="이름/색 변경 (설정)"
    >
      <div
        className="w-4 h-4 rounded-full flex items-center justify-center"
        style={{ background: color }}
      >
        <User className="w-2.5 h-2.5 text-white" />
      </div>
      <span style={{ color: 'var(--text-secondary)' }}>@me</span>
      <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{name}</span>
    </button>
  );
}
