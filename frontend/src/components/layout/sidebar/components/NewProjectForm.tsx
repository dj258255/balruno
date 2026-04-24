/**
 * NewProjectForm - 새 프로젝트 생성 폼 컴포넌트
 */

'use client';

import { useEffect, useState, useRef } from 'react';
import { FolderPlus, Check, X, LayoutTemplate, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useProjectStore } from '@/stores/projectStore';

interface NewProjectFormProps {
  showNewProject: boolean;
  setShowNewProject: (show: boolean) => void;
  newProjectName: string;
  setNewProjectName: (name: string) => void;
  onCreateProject: () => void;
}

export function NewProjectForm({
  showNewProject,
  setShowNewProject,
  newProjectName,
  setNewProjectName,
  onCreateProject,
}: NewProjectFormProps) {
  const t = useTranslations();
  const createFromSample = useProjectStore((s) => s.createFromSample);

  // 우클릭 컨텍스트 메뉴 — 새 프로젝트 버튼에서 빠른 샘플 시작
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

  // 빈 공간 우클릭 메뉴 · CommandPalette 등 외부에서 "새 프로젝트" 열기 요청
  useEffect(() => {
    const handler = () => setShowNewProject(true);
    window.addEventListener('balruno:open-new-project', handler);
    return () => window.removeEventListener('balruno:open-new-project', handler);
  }, [setShowNewProject]);

  if (!showNewProject) {
    return (
      <div className="p-3 border-b space-y-1.5 relative" style={{ borderColor: 'var(--border-primary)' }}>
        <button
          onClick={() => setShowNewProject(true)}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setCtxMenu({ x: e.clientX, y: e.clientY });
          }}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors"
          style={{
            background: 'var(--accent)',
            color: 'white'
          }}
        >
          <FolderPlus className="w-4 h-4" />
          {t('sidebar.newProject')}
        </button>
        <button
          onClick={() => window.dispatchEvent(new Event('balruno:open-gallery'))}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setCtxMenu({ x: e.clientX, y: e.clientY });
          }}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors"
          style={{
            background: 'var(--bg-tertiary)',
            color: 'var(--text-secondary)',
          }}
          title="템플릿으로 빠르게 시작 · 우클릭: 빠른 샘플"
        >
          <LayoutTemplate className="w-3.5 h-3.5" />
          템플릿 갤러리
        </button>

        {ctxMenu && (
          <div
            ref={ctxMenuRef}
            className="fixed z-50 min-w-[200px] py-1 rounded-lg shadow-lg border"
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
                setShowNewProject(true);
                setCtxMenu(null);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors hover:bg-[var(--bg-hover)]"
              style={{ color: 'var(--text-primary)' }}
            >
              <FolderPlus className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
              빈 프로젝트로 시작
            </button>
            <div className="my-1 border-t" style={{ borderColor: 'var(--border-primary)' }} />
            <button
              type="button"
              onClick={() => {
                createFromSample('rpg-character', t('samples.rpgCharacter.name'), t);
                setCtxMenu(null);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors hover:bg-[var(--bg-hover)]"
              style={{ color: 'var(--text-primary)' }}
            >
              <Sparkles className="w-4 h-4" style={{ color: '#3b82f6' }} />
              밸런싱 — RPG 캐릭터 샘플
            </button>
            <button
              type="button"
              onClick={() => {
                createFromSample('sprint-board', t('samples.sprintBoard.name'), t);
                setCtxMenu(null);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors hover:bg-[var(--bg-hover)]"
              style={{ color: 'var(--text-primary)' }}
            >
              <Sparkles className="w-4 h-4" style={{ color: '#f59e0b' }} />
              팀 PM — 스프린트 보드 샘플
            </button>
            <button
              type="button"
              onClick={() => {
                window.dispatchEvent(new Event('balruno:open-gallery'));
                setCtxMenu(null);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors hover:bg-[var(--bg-hover)]"
              style={{ color: 'var(--text-primary)' }}
            >
              <LayoutTemplate className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
              전체 샘플 갤러리
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-3 border-b" style={{ borderColor: 'var(--border-primary)' }}>
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={newProjectName}
          onChange={(e) => setNewProjectName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onCreateProject();
            if (e.key === 'Escape') {
              setShowNewProject(false);
              setNewProjectName('');
            }
          }}
          placeholder={t('project.projectName')}
          className="flex-1 min-w-0 px-3 py-2 text-sm rounded-lg"
          autoFocus
        />
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={onCreateProject}
            className="p-2 rounded-lg transition-colors"
            style={{
              background: 'var(--accent)',
              color: 'white'
            }}
          >
            <Check className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              setShowNewProject(false);
              setNewProjectName('');
            }}
            className="p-2 rounded-lg transition-colors"
            style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
