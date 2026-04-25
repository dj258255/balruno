'use client';

/**
 * StarterPickerModal — 첫 진입 시 자동 표시.
 * 사용자가 자기 게임 장르를 골라 starter pack 시드.
 *
 * 트리거: page.tsx 의 init 흐름 — savedProjects.length === 0 + 'balruno:starter-seeded' 없음
 * 선택 후: createProject(name, desc, { seedStarterId: 'rpg' }) 호출 → 시트 자동 생성
 */

import { STARTER_CATALOG } from '@/lib/starterPack';

interface Props {
  onPick: (starterId: string) => void;
  onClose?: () => void;
}

export default function StarterPickerModal({ onPick, onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-[1300] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.55)' }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl shadow-2xl"
        style={{ background: 'var(--bg-primary)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-3 text-center border-b" style={{ borderColor: 'var(--border-primary)' }}>
          <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
            어떤 게임을 만들고 있어요?
          </h2>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            장르를 고르면 그에 맞는 시작용 시트가 자동으로 생성돼요. 나중에 자유롭게 편집/삭제 가능.
          </p>
        </div>

        {/* Catalog grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4">
          {STARTER_CATALOG.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => onPick(entry.id)}
              className="group flex flex-col items-start gap-2 p-4 rounded-xl border-2 transition-all text-left hover:border-[var(--accent)] hover:scale-[1.02]"
              style={{
                background: 'var(--bg-secondary)',
                borderColor: 'var(--border-primary)',
              }}
            >
              <div className="text-2xl">{entry.emoji}</div>
              <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                {entry.label}
              </div>
              <div className="text-caption line-clamp-2" style={{ color: 'var(--text-tertiary)' }}>
                {entry.description}
              </div>
            </button>
          ))}
        </div>

        {/* Footer */}
        <div
          className="px-6 py-3 border-t flex items-center justify-between text-caption"
          style={{ borderColor: 'var(--border-primary)', color: 'var(--text-tertiary)' }}
        >
          <span>총 {STARTER_CATALOG.length} 가지 시작 팩</span>
          <span>나중에 사이드바 + 버튼으로 더 추가할 수 있어요</span>
        </div>
      </div>
    </div>
  );
}
