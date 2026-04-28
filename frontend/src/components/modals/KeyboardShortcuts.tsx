'use client';

/**
 * Track UX — 키보드 단축키 치트시트.
 * Cmd+/ 또는 Ctrl+/ 로 토글. CommandPalette 옆에 배치되는 빠른 참고서.
 */

import { useEffect } from 'react';
import { X, Keyboard } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface Props {
  open: boolean;
  onClose: () => void;
}

const SHORTCUTS: Array<{ catKey: string; items: Array<{ keys: string; descKey: string }> }> = [
  {
    catKey: 'kbShortcuts.catGlobal',
    items: [
      { keys: '⌘/Ctrl + K', descKey: 'kbShortcuts.palette' },
      { keys: '?', descKey: 'kbShortcuts.help' },
      { keys: '⌘/Ctrl + /', descKey: 'kbShortcuts.helpAlt' },
      { keys: '⌘/Ctrl + Z', descKey: 'kbShortcuts.undo' },
      { keys: '⌘/Ctrl + Shift + Z', descKey: 'kbShortcuts.redo' },
      { keys: '⌘/Ctrl + Shift + N', descKey: 'kbShortcuts.newProject' },
      { keys: '⌘/Ctrl + N', descKey: 'kbShortcuts.newSheet' },
      { keys: '⌘/Ctrl + Shift + F', descKey: 'kbShortcuts.formulaHelper' },
      { keys: '⌘/Ctrl + Shift + L', descKey: 'kbShortcuts.themeToggle' },
      { keys: '⌘/Ctrl + Shift + D', descKey: 'kbShortcuts.dedupe' },
    ],
  },
  {
    catKey: 'kbShortcuts.catView',
    items: [
      { keys: 'G', descKey: 'kbShortcuts.gridView' },
      { keys: 'K', descKey: 'kbShortcuts.kanbanView' },
      { keys: 'C', descKey: 'kbShortcuts.calendarView' },
      { keys: 'Y', descKey: 'kbShortcuts.galleryView' },
      { keys: 'T', descKey: 'kbShortcuts.ganttView' },
      { keys: 'F', descKey: 'kbShortcuts.formView' },
    ],
  },
  {
    catKey: 'kbShortcuts.catSheet',
    items: [
      { keys: 'Enter', descKey: 'kbShortcuts.startEdit' },
      { keys: 'Tab', descKey: 'kbShortcuts.tabRight' },
      { keys: 'Esc', descKey: 'kbShortcuts.cancelEdit' },
      { keys: 'Delete', descKey: 'kbShortcuts.deleteCell' },
      { keys: '↑ ↓ ← →', descKey: 'kbShortcuts.moveCell' },
      { keys: 'Shift + click', descKey: 'kbShortcuts.rangeSelect' },
      { keys: '__drag__', descKey: 'kbShortcuts.dragSelect' },
    ],
  },
  {
    catKey: 'kbShortcuts.catRow',
    items: [
      { keys: 'J', descKey: 'kbShortcuts.nextRow' },
      { keys: 'E', descKey: 'kbShortcuts.editFocusRow' },
      { keys: 'N / +', descKey: 'kbShortcuts.newRow' },
      { keys: 'D', descKey: 'kbShortcuts.deleteRow' },
    ],
  },
  {
    catKey: 'kbShortcuts.catFormula',
    items: [
      { keys: '=', descKey: 'kbShortcuts.formulaMode' },
      { keys: '↑ ↓', descKey: 'kbShortcuts.autocompleteNav' },
      { keys: 'Tab / Enter', descKey: 'kbShortcuts.autocompleteConfirm' },
    ],
  },
];

export default function KeyboardShortcuts({ open, onClose }: Props) {
  const t = useTranslations();
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
            <h2 id="shortcuts-title" className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{t('kbShortcuts.title')}</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-[var(--bg-tertiary)]" aria-label={t('kbShortcuts.closeAria')}>
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 grid sm:grid-cols-2 gap-4">
          {SHORTCUTS.map((cat) => (
            <div key={cat.catKey}>
              <h3 className="text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                {t(cat.catKey as 'kbShortcuts.catGlobal')}
              </h3>
              <div className="space-y-1.5">
                {cat.items.map((s) => (
                  <div key={s.keys} className="flex items-center justify-between gap-2">
                    <span className="text-xs" style={{ color: 'var(--text-primary)' }}>{t(s.descKey as 'kbShortcuts.palette')}</span>
                    <kbd
                      className="text-caption font-mono px-1.5 py-0.5 rounded border flex-shrink-0"
                      style={{
                        background: 'var(--bg-tertiary)',
                        borderColor: 'var(--border-primary)',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      {s.keys === '__drag__' ? t('kbShortcuts.dragLabel') : s.keys}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="p-3 text-caption text-center border-t" style={{ borderColor: 'var(--border-primary)', color: 'var(--text-tertiary)' }}>
          {t('kbShortcuts.paletteHint')}
        </div>
      </div>
    </div>
  );
}
