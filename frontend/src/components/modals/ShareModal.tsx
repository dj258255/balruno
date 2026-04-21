'use client';

/**
 * Track 8 MVP — 프로젝트 공유 / WebRTC P2P 협업.
 *
 * 동작:
 *  - "협업 활성화" 토글 → project.syncMode = 'cloud' + syncRoomId 생성
 *  - attachWebrtc(projectId, roomId) → y-webrtc 공용 신호서버 통해 P2P 연결
 *  - awareness API 로 접속자 수 실시간 표시
 *  - URL `?room=xxx` 복사 → 같은 브라우저 다른 창 / 다른 기기에서 동일 room 자동 연결
 *
 * MVP 한계:
 *  - 받는 쪽 (link 클릭) 자동 처리는 page.tsx 의 hash 파싱 의존
 *  - 사용자 이름 / 색상 / 커서 표시는 다음 단계
 */

import { useEffect, useState } from 'react';
import { X, Copy, Users, Check, Wifi, WifiOff, User } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { useTranslations } from 'next-intl';
import { useProjectStore } from '@/stores/projectStore';
import { attachWebrtc, detachWebrtc } from '@/lib/ydoc';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { usePresence, setUserIdentity } from '@/hooks/usePresence';

interface ShareModalProps {
  onClose: () => void;
}

export default function ShareModal({ onClose }: ShareModalProps) {
  useEscapeKey(onClose);
  const t = useTranslations();

  const currentProjectId = useProjectStore((s) => s.currentProjectId);
  const project = useProjectStore((s) =>
    s.projects.find((p) => p.id === s.currentProjectId)
  );
  const updateProject = useProjectStore((s) => s.updateProject);

  const [copied, setCopied] = useState(false);
  const [peerCount, setPeerCount] = useState(0);
  const [readOnly, setReadOnly] = useState(false);
  const [expiryKey, setExpiryKey] = useState<'none' | '1h' | '1d' | '7d'>('none');

  // Presence 식별 (사용자 이름 변경)
  const { myName, myColor } = usePresence(currentProjectId);
  const [editingName, setEditingName] = useState(myName);
  useEffect(() => setEditingName(myName), [myName]);
  const handleSaveName = () => {
    const trimmed = editingName.trim();
    if (trimmed && trimmed !== myName) setUserIdentity(trimmed, myColor);
  };
  const PALETTE = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#06b6d4'];
  const handleColorChange = (color: string) => {
    setUserIdentity(myName, color);
  };

  const isActive = project?.syncMode === 'cloud' && !!project.syncRoomId;
  const roomUrl = (() => {
    if (!isActive || !project?.syncRoomId || typeof window === 'undefined') return null;
    const params = new URLSearchParams({ room: project.syncRoomId });
    if (readOnly) params.set('readonly', '1');
    if (expiryKey !== 'none') {
      const ms = { '1h': 3600_000, '1d': 86400_000, '7d': 604800_000 }[expiryKey];
      params.set('expires', String(Date.now() + ms));
    }
    return `${window.location.origin}/?${params.toString()}`;
  })();

  // 활성화 시 WebRTC 자동 연결 + awareness 구독
  useEffect(() => {
    if (!isActive || !project?.syncRoomId || !currentProjectId) return;
    const provider = attachWebrtc(currentProjectId, project.syncRoomId);
    const updateCount = () => {
      // 자기 자신 제외 (states.size - 1)
      setPeerCount(Math.max(0, provider.awareness.getStates().size - 1));
    };
    provider.awareness.on('change', updateCount);
    updateCount();
    return () => {
      provider.awareness.off('change', updateCount);
    };
  }, [isActive, project?.syncRoomId, currentProjectId]);

  const handleActivate = () => {
    if (!project) return;
    updateProject(project.id, {
      syncMode: 'cloud',
      syncRoomId: uuidv4(),
    });
  };

  const handleDeactivate = () => {
    if (!project) return;
    detachWebrtc(project.id);
    updateProject(project.id, {
      syncMode: 'local',
      syncRoomId: undefined,
    });
    setPeerCount(0);
  };

  const handleCopy = async () => {
    if (!roomUrl) return;
    try {
      await navigator.clipboard.writeText(roomUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: select + execCommand 생략
    }
  };

  if (!project) {
    return (
      <div className="fixed inset-0 modal-overlay flex items-center justify-center z-[1100] p-4">
        <div
          className="w-full max-w-md rounded-2xl shadow-2xl p-6 text-center"
          style={{ background: 'var(--bg-primary)' }}
        >
          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
            공유할 프로젝트가 없습니다. 먼저 프로젝트를 선택하세요.
          </p>
          <button
            onClick={onClose}
            className="mt-4 px-4 py-2 rounded-lg text-sm"
            style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
          >
            닫기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 modal-overlay flex items-center justify-center z-[1100] p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-modal-title"
        className="w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-scaleIn"
        style={{ background: 'var(--bg-primary)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div
          className="flex items-center justify-between px-5 py-3 border-b"
          style={{ borderColor: 'var(--border-primary)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(59, 130, 246, 0.15)' }}
            >
              <Users className="w-5 h-5" style={{ color: '#3b82f6' }} />
            </div>
            <div>
              <h2 id="share-modal-title" className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                프로젝트 공유
              </h2>
              <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                {project.name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-[var(--bg-hover)]"
            style={{ color: 'var(--text-tertiary)' }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* 내 정보 (이름 + 색상) */}
          <div
            className="p-4 rounded-xl space-y-2"
            style={{ background: 'var(--bg-secondary)' }}
          >
            <div className="flex items-center gap-2 mb-1">
              <User className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
              <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                내 표시 이름 / 색상
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold text-white shrink-0"
                style={{ background: myColor }}
              >
                {editingName
                  .split(/[-\s]/)
                  .map((p) => p[0])
                  .filter(Boolean)
                  .slice(0, 2)
                  .join('')
                  .toUpperCase() || '?'}
              </div>
              <input
                type="text"
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                onBlur={handleSaveName}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                className="flex-1 input-base"
                style={{
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border-primary)',
                  color: 'var(--text-primary)',
                }}
                placeholder="표시 이름"
              />
            </div>
            <div className="flex items-center gap-1.5 pt-1">
              {PALETTE.map((c) => (
                <button
                  key={c}
                  onClick={() => handleColorChange(c)}
                  className="w-6 h-6 rounded-full transition-transform hover:scale-110"
                  style={{
                    background: c,
                    outline: c === myColor ? '2px solid var(--text-primary)' : 'none',
                    outlineOffset: 2,
                  }}
                  aria-label={`색상 ${c}`}
                />
              ))}
            </div>
          </div>

          {/* 활성화 토글 */}
          <div
            className="p-4 rounded-xl"
            style={{ background: 'var(--bg-secondary)' }}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {isActive ? (
                  <Wifi className="w-4 h-4" style={{ color: '#10b981' }} />
                ) : (
                  <WifiOff className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
                )}
                <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  실시간 협업
                </span>
              </div>
              <button
                onClick={isActive ? handleDeactivate : handleActivate}
                className="px-3 py-1 rounded-lg text-xs font-medium transition-colors"
                style={{
                  background: isActive ? '#ef4444' : '#10b981',
                  color: 'white',
                }}
              >
                {isActive ? '비활성화' : '활성화'}
              </button>
            </div>
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
              {isActive
                ? `WebRTC P2P 연결됨 — 다른 ${peerCount}명 접속 중`
                : 'y-webrtc 공용 신호서버를 통한 P2P 협업. 활성화하면 링크를 받은 사람과 실시간 동기화.'}
            </p>
          </div>

          {/* 공유 URL + 권한/만료 */}
          {isActive && roomUrl && (
            <div className="space-y-3">
              {/* 권한 */}
              <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'var(--bg-secondary)' }}>
                <div>
                  <div className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
                    권한
                  </div>
                  <div className="text-caption" style={{ color: 'var(--text-tertiary)' }}>
                    {readOnly ? '링크 받는 사람은 보기만 가능' : '편집 + 동기화 전체 허용'}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => setReadOnly(false)}
                    className="text-caption px-2 py-1 rounded"
                    style={{
                      background: !readOnly ? 'var(--accent)' : 'var(--bg-tertiary)',
                      color: !readOnly ? 'white' : 'var(--text-secondary)',
                    }}
                  >
                    편집
                  </button>
                  <button
                    onClick={() => setReadOnly(true)}
                    className="text-caption px-2 py-1 rounded"
                    style={{
                      background: readOnly ? 'var(--accent)' : 'var(--bg-tertiary)',
                      color: readOnly ? 'white' : 'var(--text-secondary)',
                    }}
                  >
                    읽기전용
                  </button>
                </div>
              </div>

              {/* 만료 */}
              <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'var(--bg-secondary)' }}>
                <div>
                  <div className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
                    링크 만료
                  </div>
                  <div className="text-caption" style={{ color: 'var(--text-tertiary)' }}>
                    {expiryKey === 'none' ? '만료 없음 (room 이 살아있는 동안 유효)' : `${expiryKey} 후 자동 만료`}
                  </div>
                </div>
                <div className="flex gap-1">
                  {(['none', '1h', '1d', '7d'] as const).map((k) => (
                    <button
                      key={k}
                      onClick={() => setExpiryKey(k)}
                      className="text-caption px-2 py-1 rounded"
                      style={{
                        background: expiryKey === k ? 'var(--accent)' : 'var(--bg-tertiary)',
                        color: expiryKey === k ? 'white' : 'var(--text-secondary)',
                      }}
                    >
                      {k === 'none' ? '없음' : k}
                    </button>
                  ))}
                </div>
              </div>

              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                공유 링크
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={roomUrl}
                  readOnly
                  className="flex-1 px-3 py-2 rounded-lg text-xs font-mono"
                  style={{
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border-primary)',
                    color: 'var(--text-primary)',
                  }}
                  onFocus={(e) => e.currentTarget.select()}
                />
                <button
                  onClick={handleCopy}
                  className="px-3 py-2 rounded-lg flex items-center gap-1.5 text-sm font-medium transition-colors"
                  style={{
                    background: copied ? '#10b981' : 'var(--accent)',
                    color: 'white',
                  }}
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4" /> 복사됨
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" /> 복사
                    </>
                  )}
                </button>
              </div>
              <p className="text-xs mt-2" style={{ color: 'var(--text-tertiary)' }}>
                팀원에게 이 링크를 공유하세요. 같은 프로젝트가 자동으로 동기화됩니다.
              </p>
            </div>
          )}

          {/* 접속자 표시 */}
          {isActive && (
            <div
              className="p-3 rounded-lg flex items-center gap-3"
              style={{ background: 'var(--bg-tertiary)' }}
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center font-semibold text-xs text-white"
                style={{ background: '#3b82f6' }}
              >
                나
              </div>
              {peerCount > 0 ? (
                <div className="flex -space-x-2">
                  {Array.from({ length: Math.min(peerCount, 4) }).map((_, i) => (
                    <div
                      key={i}
                      className="w-8 h-8 rounded-full border-2 border-[var(--bg-primary)] flex items-center justify-center text-xs text-white"
                      style={{
                        background: ['#10b981', '#f59e0b', '#8b5cf6', '#ec4899'][i % 4],
                      }}
                    >
                      P{i + 1}
                    </div>
                  ))}
                  {peerCount > 4 && (
                    <div
                      className="w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs"
                      style={{
                        borderColor: 'var(--bg-primary)',
                        background: 'var(--bg-secondary)',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      +{peerCount - 4}
                    </div>
                  )}
                </div>
              ) : (
                <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  현재 혼자 — 링크를 공유해서 팀원을 초대하세요
                </span>
              )}
            </div>
          )}

          {/* 주의사항 */}
          <div
            className="text-xs p-3 rounded-lg"
            style={{
              background: 'rgba(245, 158, 11, 0.1)',
              color: 'var(--warning)',
            }}
          >
            <strong>MVP 안내:</strong> 공용 신호서버 사용 (signaling.yjs.dev).
            데이터는 P2P 로 직접 전송되며 신호서버는 메타데이터만 봅니다.
            대규모 팀에는 자체 신호서버 권장.
          </div>
        </div>
      </div>
    </div>
  );
}
