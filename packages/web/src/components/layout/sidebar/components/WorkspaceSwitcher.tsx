/**
 * WorkspaceSwitcher — 사이드바 최상단. Notion / Linear / Airtable 공통 패턴.
 *
 * 데이터 모델 (점진 마이그레이션, 2026-05-06):
 *  - 워크스페이스 목록 = useWorkspaceListStore (server-canonical, Linear 모델)
 *  - 활성 워크스페이스 ID = useSidebarPrefs.activeWorkspaceId (UI 선호, persist)
 *  - 이름 변경 = updateWorkspace REST API + 캐시 refresh
 *  - 새 워크스페이스 = /workspaces 페이지로 navigate (전용 생성 폼)
 *
 * 본격 multi-ws 전환 (ws 변경 시 사이드바 리로드, projectStore ws-aware) 은
 * sync phase 와 함께. 현재는 활성 ID 표시 + 다른 ws 클릭 시 detail 페이지로
 * 이동하는 정도.
 */

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { ChevronDown, Plus, Settings, Edit2, Sparkles, Users, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemeToggle } from '@/components/ui';
import { useSidebarPrefs } from '@/stores/sidebarPrefsStore';
import { useWorkspaceListStore } from '@/stores/workspaceListStore';
import { useProductIntro } from '@/stores/productIntroStore';
import { MemberManagementModal } from '@/components/workspace/MemberManagementModal';

interface WorkspaceSwitcherProps {
  onOpenSettings?: () => void;
}

export function WorkspaceSwitcher({ onOpenSettings }: WorkspaceSwitcherProps) {
  const tMembers = useTranslations('members');
  const [showMembers, setShowMembers] = useState(false);
  const t = useTranslations();
  const { theme } = useTheme();
  const router = useRouter();

  const activeWorkspaceId = useSidebarPrefs((s) => s.activeWorkspaceId);
  const setActiveWorkspace = useSidebarPrefs((s) => s.setActiveWorkspace);

  const workspaces = useWorkspaceListStore((s) => s.workspaces);
  const status = useWorkspaceListStore((s) => s.status);
  const bootstrap = useWorkspaceListStore((s) => s.bootstrap);
  const renameRemote = useWorkspaceListStore((s) => s.rename);

  // First-render fetch — store handles dedup so re-mounts are free.
  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

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
  const displayName =
    active?.name
    ?? (status === 'loading' ? '...' : t('sidebar.workspaceSwitcher.defaultName'));

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
            {status === 'loading' && workspaces.length === 0 && (
              <div className="px-3 py-2 flex items-center gap-2 text-sm" style={{ color: 'var(--text-tertiary)' }}>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>...</span>
              </div>
            )}
            {workspaces.map((w) => (
              <button
                key={w.id}
                type="button"
                onClick={() => {
                  setActiveWorkspace(w.id);
                  setOpen(false);
                }}
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
            {/* 새 워크스페이스 — 전용 페이지로 이동 */}
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                router.push('/workspaces');
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors hover:bg-[var(--bg-hover)]"
            >
              <Plus className="w-4 h-4 shrink-0" style={{ color: 'var(--text-tertiary)' }} />
              <span className="flex-1" style={{ color: 'var(--text-primary)' }}>
                {t('sidebar.workspaceSwitcher.newWorkspace')}
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

            {/* 멤버 관리 */}
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setShowMembers(true);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors hover:bg-[var(--bg-hover)]"
              style={{ color: 'var(--text-primary)' }}
            >
              <Users className="w-4 h-4 shrink-0" style={{ color: 'var(--text-secondary)' }} />
              <span>{tMembers('title')}</span>
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

      {showMembers && activeWorkspaceId && (
        <MemberManagementModal
          workspaceId={activeWorkspaceId}
          onClose={() => setShowMembers(false)}
        />
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
              setCtxMenu(null);
              if (next && next.trim() && next.trim() !== active.name) {
                // Backend mutation; the store refresh re-syncs the cache so
                // the dropdown reflects the new name on next open.
                void renameRemote(active.id, next).then(() => {
                  toast.success(t('sidebar.workspaceRenamed'));
                }).catch((e: unknown) => {
                  toast.error(e instanceof Error ? e.message : 'rename failed');
                });
              }
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
