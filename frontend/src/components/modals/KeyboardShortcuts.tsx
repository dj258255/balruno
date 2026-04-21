'use client';

/**
 * Track UX — 키보드 단축키 치트시트.
 * Cmd+/ 또는 Ctrl+/ 로 토글. CommandPalette 옆에 배치되는 빠른 참고서.
 */

import { useEffect } from 'react';
import { X, Keyboard } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
}

const SHORTCUTS: Array<{ category: string; items: Array<{ keys: string; desc: string }> }> = [
  {
    category: '전역',
    items: [
      { keys: '⌘/Ctrl + K', desc: '명령 팔레트 열기' },
      { keys: '?', desc: '단축키 도움말' },
      { keys: '⌘/Ctrl + /', desc: '단축키 도움말 (수정자 버전)' },
      { keys: '⌘/Ctrl + Z', desc: '되돌리기' },
      { keys: '⌘/Ctrl + Shift + Z', desc: '다시 실행' },
      { keys: '⌘/Ctrl + Shift + N', desc: '새 프로젝트' },
      { keys: '⌘/Ctrl + N', desc: '새 시트' },
      { keys: '⌘/Ctrl + Shift + F', desc: 'Formula Helper' },
      { keys: '⌘/Ctrl + Shift + L', desc: '테마 토글' },
      { keys: '⌘/Ctrl + Shift + D', desc: '중복 프로젝트 정리' },
    ],
  },
  {
    category: '뷰 전환 (입력 포커스 외)',
    items: [
      { keys: 'G', desc: 'Grid 뷰' },
      { keys: 'K', desc: 'Kanban 뷰' },
      { keys: 'C', desc: 'Calendar 뷰' },
      { keys: 'Y', desc: 'Gallery 뷰' },
      { keys: 'T', desc: 'Gantt 뷰' },
      { keys: 'F', desc: 'Form 뷰' },
    ],
  },
  {
    category: '시트 편집',
    items: [
      { keys: 'Enter', desc: '셀 편집 시작 / 다음 행으로' },
      { keys: 'Tab', desc: '오른쪽 셀로 이동' },
      { keys: 'Esc', desc: '편집 취소' },
      { keys: 'Delete', desc: '셀 값 삭제' },
      { keys: '↑ ↓ ← →', desc: '셀 이동' },
      { keys: 'Shift + click', desc: '범위 선택' },
      { keys: '드래그', desc: '범위 선택 / fill handle' },
    ],
  },
  {
    category: '행 조작 (입력 포커스 외)',
    items: [
      { keys: 'J', desc: '다음 행으로' },
      { keys: 'E', desc: '포커스 행 편집' },
      { keys: 'N / +', desc: '새 행' },
      { keys: 'D', desc: '포커스 행 삭제' },
    ],
  },
  {
    category: '공식',
    items: [
      { keys: '=', desc: '셀에 = 입력 시 수식 모드' },
      { keys: '↑ ↓', desc: '자동완성 후보 이동' },
      { keys: 'Tab / Enter', desc: '자동완성 확정' },
    ],
  },
];

export default function KeyboardShortcuts({ open, onClose }: Props) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-title"
        className="w-full max-w-2xl max-h-[80vh] rounded-xl shadow-2xl overflow-hidden flex flex-col"
        style={{ background: 'var(--bg-primary)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--border-primary)' }}>
          <div className="flex items-center gap-2">
            <Keyboard size={16} style={{ color: 'var(--accent)' }} />
            <h2 id="shortcuts-title" className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>키보드 단축키</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-[var(--bg-tertiary)]">
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 grid sm:grid-cols-2 gap-4">
          {SHORTCUTS.map((cat) => (
            <div key={cat.category}>
              <h3 className="text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                {cat.category}
              </h3>
              <div className="space-y-1.5">
                {cat.items.map((s) => (
                  <div key={s.keys} className="flex items-center justify-between gap-2">
                    <span className="text-xs" style={{ color: 'var(--text-primary)' }}>{s.desc}</span>
                    <kbd
                      className="text-[10px] font-mono px-1.5 py-0.5 rounded border flex-shrink-0"
                      style={{
                        background: 'var(--bg-tertiary)',
                        borderColor: 'var(--border-primary)',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      {s.keys}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="p-3 text-[10px] text-center border-t" style={{ borderColor: 'var(--border-primary)', color: 'var(--text-tertiary)' }}>
          더 많은 명령은 ⌘/Ctrl + K 로 명령 팔레트를 여세요
        </div>
      </div>
    </div>
  );
}
