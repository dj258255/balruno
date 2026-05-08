'use client';

/**
 * Cmd+K command palette — quick switcher for sheets / docs in the
 * current project + a few global commands. Linear / Notion / Figma
 * all ship one; the muscle-memory expectation is universal.
 *
 * v1 scope: sheet/doc tree of the active project, no cross-workspace
 * jumping. Search is case-insensitive substring on names. Keyboard
 * arrows + Enter navigate; Esc closes.
 *
 * Mounted globally in app/layout.tsx via the CommandPaletteHost
 * wrapper (which binds the Cmd+K / Ctrl+K shortcut and renders the
 * palette into a portal).
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter, useParams } from 'next/navigation';
import { Search, FileSpreadsheet, FileText, Settings, Inbox } from 'lucide-react';
import { useProjectStore } from '@/stores/projectStore';

interface PaletteItem {
  id: string;
  label: string;
  hint?: string;
  icon: typeof Search;
  run: () => void;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export function CommandPalette({ open, onClose }: Props) {
  const router = useRouter();
  const params = useParams<{ slug?: string; projectSlug?: string }>();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  // Fresh state every open
  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      // Focus is asynchronous because the input mounts under a
      // portal that hasn't laid out yet on this microtask.
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const project = useProjectStore((s) =>
    s.projects.find((p) => p.id === s.currentProjectId) ?? null,
  );

  const items = useMemo<PaletteItem[]>(() => {
    const out: PaletteItem[] = [];
    if (project) {
      for (const sheet of project.sheets) {
        out.push({
          id: `sheet-${sheet.id}`,
          label: sheet.name || '(unnamed sheet)',
          hint: '시트',
          icon: FileSpreadsheet,
          run: () => {
            useProjectStore.getState().setCurrentSheet(sheet.id);
            onClose();
          },
        });
      }
      for (const doc of project.docs ?? []) {
        out.push({
          id: `doc-${doc.id}`,
          label: doc.name || '(unnamed doc)',
          hint: '문서',
          icon: FileText,
          run: () => {
            useProjectStore.setState({ currentDocId: doc.id, currentSheetId: null });
            onClose();
          },
        });
      }
    }
    out.push({
      id: 'inbox',
      label: '인박스 열기',
      hint: '받은 멘션',
      icon: Inbox,
      run: () => { router.push('/inbox'); onClose(); },
    });
    out.push({
      id: 'notification-settings',
      label: '알림 설정',
      hint: '/settings/notifications',
      icon: Settings,
      run: () => { router.push('/settings/notifications'); onClose(); },
    });
    out.push({
      id: 'account-settings',
      label: '계정 / 데이터 export',
      hint: '/settings/account',
      icon: Settings,
      run: () => { router.push('/settings/account'); onClose(); },
    });
    return out;
  }, [project, router, onClose]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => i.label.toLowerCase().includes(q) || (i.hint && i.hint.toLowerCase().includes(q)));
  }, [items, query]);

  // Keep activeIndex in range as the filter shrinks the list.
  useEffect(() => {
    setActiveIndex((idx) => Math.max(0, Math.min(idx, Math.max(0, filtered.length - 1))));
  }, [filtered.length]);

  if (!open) return null;
  if (typeof document === 'undefined') return null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const item = filtered[activeIndex];
      if (item) item.run();
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[10vh]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-lg border shadow-2xl"
        style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-primary)' }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center gap-2 border-b px-3" style={{ borderColor: 'var(--border-primary)' }}>
          <Search className="h-4 w-4" style={{ color: 'var(--text-tertiary)' }} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="시트 / 문서 / 명령 검색..."
            className="h-12 flex-1 bg-transparent text-sm outline-none"
            style={{ color: 'var(--text-primary)' }}
          />
          <kbd className="rounded border px-1.5 py-0.5 text-[10px]" style={{ borderColor: 'var(--border-primary)', color: 'var(--text-tertiary)' }}>
            esc
          </kbd>
        </div>
        <ul className="max-h-[50vh] overflow-y-auto py-1">
          {filtered.length === 0 && (
            <li className="px-4 py-6 text-center text-xs" style={{ color: 'var(--text-tertiary)' }}>
              결과 없음
            </li>
          )}
          {filtered.map((item, idx) => {
            const Icon = item.icon;
            const active = idx === activeIndex;
            return (
              <li
                key={item.id}
                className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm"
                style={{
                  background: active ? 'var(--bg-hover)' : 'transparent',
                  color: 'var(--text-primary)',
                }}
                onMouseEnter={() => setActiveIndex(idx)}
                onClick={() => item.run()}
              >
                <Icon className="h-4 w-4" style={{ color: 'var(--text-tertiary)' }} />
                <span className="flex-1">{item.label}</span>
                {item.hint && (
                  <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    {item.hint}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>,
    document.body,
  );
}
