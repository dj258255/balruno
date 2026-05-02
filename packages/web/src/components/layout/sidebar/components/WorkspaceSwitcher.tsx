'use client';

/**
 * WorkspaceSwitcher — 사이드바 최상단. Notion / Linear / Airtable 공통 패턴.
 *
 * 현재 단계:
 *  - 워크스페이스는 단일 'default' 만 존재 (멀티는 백엔드 + Team 플랜에서)
 *  - 드롭다운은 현재 이름 표시 + "새 워크스페이스 (Team 플랜)" 비활성 힌트
 *  - 설정 링크는 기존 Settings 모달로 연결
 */

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { ChevronDown, Plus, Settings, Edit2, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemeToggle } from '@/components/ui';
import { useSidebarPrefs } from '@/stores/sidebarPrefsStore';
import { useProductIntro } from '@/stores/productIntroStore';

interface WorkspaceSwitcherProps {
  onOpenSettings?: () => void;
}

export function WorkspaceSwitcher({ onOpenSettings }: WorkspaceSwitcherProps) {
  const t = useTranslations();
  const { theme } = useTheme();
  const { workspaces, activeWorkspaceId, renameWorkspace } = useSidebarPrefs();
  const openProductIntro = useProductIntro((s) => s.openIntro);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // 우클릭 컨텍스트 메뉴 — 이름 변경 / 설정 바로가기
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);
  const ctxMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ctxMenu) return;
    const onDown = (e: MouseEvent) => {
      if (ctxMenuRef.current && !ctxMenuRef.current.contains(e.target as Node)) {
        setCtxMenu(null);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [ctxMenu]);

  const active = workspaces.find((w) => w.id === activeWorkspaceId) ?? workspaces[0];
  const displayName = active?.name ?? t('sidebar.workspaceSwitcher.defaultName');

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div
      ref={rootRef}
      data-electron-traffic-zone
      className="relative px-2 py-2 border-b flex items-center gap-1"
      style={{ borderColor: 'var(--border-primary)' }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setCtxMenu({ x: e.clientX, y: e.clientY });
        }}
        className="flex-1 min-w-0 flex items-center gap-2 px-2 py-1.5 rounded-md transition-colors hover:bg-[var(--bg-hover)]"
        style={{ color: 'var(--text-primary)' }}
      >
        <Image
          src={theme === 'dark' ? '/icon-dark.svg' : '/icon.svg'}
          alt="Logo"
          width={20}
          height={20}
          className="rounded shrink-0"
        />
        <span className="flex-1 text-sm font-semibold truncate text-left">{displayName}</span>
        <ChevronDown
          className="w-3.5 h-3.5 shrink-0 transition-transform"
          style={{
            color: 'var(--text-secondary)',
            transform: open ? 'rotate(180deg)' : undefined,
          }}
        />
      </button>
      <ThemeToggle />

      {open && (
        <div
          className="absolute left-2 right-2 top-full mt-1 z-40 rounded-lg border shadow-lg overflow-hidden"
          style={{
            background: 'var(--bg-primary)',
            borderColor: 'var(--border-primary)',
          }}
        >
          {/* 현재 워크스페이스 목록 */}
          <div className="py-1">
            {workspaces.map((w) => (
              <button
                key={w.id}
                type="button"
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors"
                style={{
                  color: 'var(--text-primary)',
                  background: w.id === activeWorkspaceId ? 'var(--bg-tertiary)' : 'transparent',
                }}
                onMouseEnter={(e) => {
                  if (w.id !== activeWorkspaceId) {
                    e.currentTarget.style.background = 'var(--bg-hover)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (w.id !== activeWorkspaceId) {
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                <Image
                  src={theme === 'dark' ? '/icon-dark.svg' : '/icon.svg'}
                  alt=""
                  width={16}
                  height={16}
                  className="rounded shrink-0"
                />
                <span className="truncate">{w.name}</span>
              </button>
            ))}
          </div>

          <div className="border-t" style={{ borderColor: 'var(--border-primary)' }}>
            {/* 새 워크스페이스 — Team 플랜 힌트 (비활성) */}
            <button
              type="button"
              disabled
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left cursor-not-allowed opacity-60"
              title={t('sidebar.workspaceSwitcher.newWorkspaceHint')}
            >
              <Plus className="w-4 h-4 shrink-0" style={{ color: 'var(--text-tertiary)' }} />
              <span className="flex-1" style={{ color: 'var(--text-secondary)' }}>
                {t('sidebar.workspaceSwitcher.newWorkspace')}
              </span>
              <span
                className="text-caption px-1.5 py-0.5 rounded-full shrink-0"
                style={{ background: 'var(--bg-tertiary)', color: 'var(--text-tertiary)' }}
              >
                Team
              </span>
            </button>

            {/* 앱 소개 다시 보기 */}
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                openProductIntro();
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors hover:bg-[var(--bg-hover)]"
              style={{ color: 'var(--text-primary)' }}
            >
              <Sparkles className="w-4 h-4 shrink-0" style={{ color: 'var(--accent)' }} />
              <span>{t('sidebar.appIntroAgain')}</span>
            </button>

            {/* 워크스페이스 설정 */}
            {onOpenSettings && (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onOpenSettings();
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors hover:bg-[var(--bg-hover)]"
                style={{ color: 'var(--text-primary)' }}
              >
                <Settings className="w-4 h-4 shrink-0" style={{ color: 'var(--text-secondary)' }} />
                <span>{t('sidebar.workspaceSwitcher.settings')}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {ctxMenu && (
        <div
          ref={ctxMenuRef}
          className="fixed z-50 min-w-[180px] py-1 rounded-lg shadow-lg border"
          style={{
            left: ctxMenu.x,
            top: ctxMenu.y,
            background: 'var(--bg-primary)',
            borderColor: 'var(--border-primary)',
          }}
        >
          <button
            type="button"
            onClick={() => {
              if (!active) {
                setCtxMenu(null);
                return;
              }
              const next = window.prompt(t('sidebar.workspaceRenamePrompt'), active.name);
              if (next && next.trim()) {
                renameWorkspace(active.id, next);
              }
              setCtxMenu(null);
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors hover:bg-[var(--bg-hover)]"
            style={{ color: 'var(--text-primary)' }}
          >
            <Edit2 className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
            {t('sidebar.workspaceRename')}
          </button>
          {onOpenSettings && (
            <button
              type="button"
              onClick={() => {
                setCtxMenu(null);
                onOpenSettings();
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors hover:bg-[var(--bg-hover)]"
              style={{ color: 'var(--text-primary)' }}
            >
              <Settings className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
              {t('sidebar.workspaceSettings')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
