'use client';

/**
 * Track 8 — 우측 상단 접속자 아바타 (Figma/Notion 스타일).
 * 활성 프로젝트의 WebRTC provider awareness 기반.
 */

import { usePresence } from '@/hooks/usePresence';

interface PresenceIndicatorProps {
  projectId: string | null;
}

export default function PresenceIndicator({ projectId }: PresenceIndicatorProps) {
  const { peers, myName, myColor } = usePresence(projectId);

  // 협업 비활성 (peers 0) 이어도 본인 아바타는 표시 — UX 통일
  if (!projectId) return null;

  const initials = (name: string) =>
    name
      .split(/[-\s]/)
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?';

  return (
    <div className="flex items-center -space-x-1.5 px-2">
      {peers.slice(0, 4).map((p) => (
        <div
          key={p.id}
          className="w-7 h-7 rounded-full border-2 flex items-center justify-center text-caption font-semibold text-white shadow-sm"
          style={{
            background: p.color,
            borderColor: 'var(--bg-primary)',
          }}
          title={p.name}
        >
          {initials(p.name)}
        </div>
      ))}
      {peers.length > 4 && (
        <div
          className="w-7 h-7 rounded-full border-2 flex items-center justify-center text-caption font-semibold shadow-sm"
          style={{
            borderColor: 'var(--bg-primary)',
            background: 'var(--bg-tertiary)',
            color: 'var(--text-secondary)',
          }}
        >
          +{peers.length - 4}
        </div>
      )}
      {/* 본인 아바타 (가장 우측) */}
      <div
        className="w-7 h-7 rounded-full border-2 flex items-center justify-center text-caption font-semibold text-white shadow-sm relative"
        style={{
          background: myColor,
          borderColor: 'var(--bg-primary)',
        }}
        title={`${myName} (나)`}
      >
        {initials(myName)}
        <span
          className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2"
          style={{ background: '#10b981', borderColor: 'var(--bg-primary)' }}
        />
      </div>
    </div>
  );
}
