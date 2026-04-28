'use client';

/**
 * 사이드바 문서 섹션 — Phase A.
 *
 * 현재 프로젝트의 docs 리스트 렌더.
 * "+ 새 문서" 버튼 · 문서 클릭 시 currentDoc 설정.
 */

import { useState, useRef, useEffect } from 'react';
import { Plus, ChevronDown, ChevronRight, Trash2, Sparkles, Edit2, Copy } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useProjectStore } from '@/stores/projectStore';
import { DOC_TEMPLATES } from '@/lib/docTemplates';
import DocIconPicker from '@/components/docs/DocIconPicker';

interface SidebarDocsSectionProps {
  /** 내부 리스트 영역의 최대 높이 (px). 사이드바 리사이즈 핸들로 동적 조절. */
  maxHeight?: number;
}

export default function SidebarDocsSection({ maxHeight = 240 }: SidebarDocsSectionProps) {
  const t = useTranslations('docs');
  const currentProjectId = useProjectStore((s) => s.currentProjectId);
  const project = useProjectStore((s) =>
    s.projects.find((p) => p.id === currentProjectId)
  );
  const currentDocId = useProjectStore((s) => s.currentDocId);
  const setCurrentDoc = useProjectStore((s) => s.setCurrentDoc);
  const setCurrentSheet = useProjectStore((s) => s.setCurrentSheet);
  const createDoc = useProjectStore((s) => s.createDoc);
  const deleteDoc = useProjectStore((s) => s.deleteDoc);
  const updateDoc = useProjectStore((s) => s.updateDoc);
  const [expanded, setExpanded] = useState(true);
  const [showTemplates, setShowTemplates] = useState(false);
  const templateMenuRef = useRef<HTMLDivElement>(null);

  // 문서 행 우클릭 컨텍스트 메뉴
  const [docCtxMenu, setDocCtxMenu] = useState<{
    x: number;
    y: number;
    docId: string;
    docName: string;
  } | null>(null);
  const docCtxMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!docCtxMenu) return;
    const onDown = (e: MouseEvent) => {
      if (docCtxMenuRef.current && !docCtxMenuRef.current.contains(e.target as Node)) {
        setDocCtxMenu(null);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [docCtxMenu]);

  useEffect(() => {
    if (!showTemplates) return;
    const onDown = (e: MouseEvent) => {
      if (templateMenuRef.current && !templateMenuRef.current.contains(e.target as Node)) {
        setShowTemplates(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [showTemplates]);

  if (!project) return null;

  const docs = project.docs ?? [];

  const handleCreate = () => {
    if (!currentProjectId) return;
    const id = createDoc(currentProjectId, t('newDocDefault'), '');
    setCurrentSheet(null);
    setCurrentDoc(id);
  };

  const handleCreateFromTemplate = (templateId: string) => {
    if (!currentProjectId) return;
    const template = DOC_TEMPLATES.find((t) => t.id === templateId);
    if (!template) return;
    const id = createDoc(currentProjectId, template.name, template.content);
    if (template.icon) {
      updateDoc(currentProjectId, id, { icon: template.icon });
    }
    setCurrentSheet(null);
    setCurrentDoc(id);
    setShowTemplates(false);
  };

  const handleOpen = (docId: string) => {
    setCurrentSheet(null);
    setCurrentDoc(docId);
  };

  const handleDelete = (e: React.MouseEvent, docId: string, name: string) => {
    e.stopPropagation();
    if (window.confirm(t('deleteShortConfirm', { name }))) {
      deleteDoc(project.id, docId);
    }
  };

  return (
    <div
      className="border-t shrink-0 flex flex-col min-h-0"
      style={{
        borderColor: 'var(--border-primary)',
        // 펼쳐진 상태: 섹션 전체 높이를 고정 (리사이즈 핸들 드래그로 조절)
        // 접힌 상태: 헤더 한 줄만 (auto)
        height: expanded ? `${maxHeight}px` : undefined,
      }}
    >
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-1 px-3 py-1.5 text-overline hover:bg-[var(--bg-hover)] transition-colors shrink-0"
        style={{ color: 'var(--text-tertiary)' }}
      >
        {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        {t('docsHeading')}
        <span className="ml-auto text-caption opacity-60">{docs.length}</span>
      </button>

      {expanded && (
        <div className="flex-1 min-h-0 px-2 pb-2 overflow-y-auto">
          <div className="relative mb-1" ref={templateMenuRef}>
            <div className="flex gap-1">
              <button
                onClick={handleCreate}
                className="flex-1 flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-left hover:bg-[var(--bg-hover)] transition-colors"
                style={{ color: 'var(--accent)' }}
              >
                <Plus className="w-3.5 h-3.5" />
                {t('newDoc')}
              </button>
              <button
                onClick={() => setShowTemplates((v) => !v)}
                className="flex items-center gap-1 px-2 py-1.5 rounded-md text-xs hover:bg-[var(--bg-hover)] transition-colors"
                title={t('templateStartTooltip')}
                style={{ color: 'var(--text-secondary)' }}
              >
                <Sparkles className="w-3 h-3" />
              </button>
            </div>
            {showTemplates && (
              <div
                className="absolute left-0 right-0 top-full mt-1 rounded-lg shadow-lg border z-20"
                style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-primary)' }}
              >
                <div className="px-2 py-1.5 text-overline border-b" style={{ borderColor: 'var(--border-primary)', color: 'var(--text-tertiary)' }}>
                  {t('templateGalleryGenre')}
                </div>
                {DOC_TEMPLATES.filter((t) => t.category === 'genre').map((t) => (
                  <button
                    key={t.id}
                    onClick={() => handleCreateFromTemplate(t.id)}
                    className="w-full text-left px-2 py-1.5 text-xs hover:bg-[var(--bg-hover)]"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    <div>{t.name}</div>
                    <div className="text-caption" style={{ color: 'var(--text-tertiary)' }}>{t.description}</div>
                  </button>
                ))}
                <div className="px-2 py-1.5 text-overline border-b border-t" style={{ borderColor: 'var(--border-primary)', color: 'var(--text-tertiary)' }}>
                  {t('templateGallerySystem')}
                </div>
                {DOC_TEMPLATES.filter((t) => t.category !== 'genre').map((t) => (
                  <button
                    key={t.id}
                    onClick={() => handleCreateFromTemplate(t.id)}
                    className="w-full text-left px-2 py-1.5 text-xs hover:bg-[var(--bg-hover)]"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    <div>{t.name}</div>
                    <div className="text-caption" style={{ color: 'var(--text-tertiary)' }}>{t.description}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {docs.length === 0 ? (
            <p className="text-caption italic px-2 py-1.5" style={{ color: 'var(--text-tertiary)' }}>
              {t('emptyDescription')}
            </p>
          ) : (
            <div className="space-y-0.5">
              {docs.map((d) => {
                const isActive = d.id === currentDocId;
                return (
                  <div
                    key={d.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleOpen(d.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleOpen(d.id);
                      }
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setDocCtxMenu({ x: e.clientX, y: e.clientY, docId: d.id, docName: d.name });
                    }}
                    className="group w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-left transition-colors cursor-pointer"
                    style={{
                      background: isActive ? 'var(--bg-tertiary)' : 'transparent',
                      color: 'var(--text-primary)',
                      fontWeight: isActive ? 600 : 400,
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) e.currentTarget.style.background = 'var(--bg-hover)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <DocIconPicker
                      icon={d.icon}
                      onChange={(emoji) => updateDoc(project.id, d.id, { icon: emoji })}
                      size="sm"
                      className="flex-shrink-0"
                    />
                    <span className="flex-1 truncate">{d.name || t('noTitlePlaceholder')}</span>
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => handleDelete(e, d.id, d.name)}
                      className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-[var(--bg-primary)]"
                      aria-label={t('delete')}
                    >
                      <Trash2 className="w-3 h-3" style={{ color: 'var(--text-tertiary)' }} />
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 문서 우클릭 컨텍스트 메뉴 — 이름 변경 / 복제 / 삭제 */}
      {docCtxMenu && (
        <div
          ref={docCtxMenuRef}
          className="fixed z-50 min-w-[160px] py-1 rounded-lg shadow-lg border"
          style={{
            left: docCtxMenu.x,
            top: docCtxMenu.y,
            background: 'var(--bg-primary)',
            borderColor: 'var(--border-primary)',
          }}
        >
          <button
            type="button"
            onClick={() => {
              const next = window.prompt(t('renamePromptLabel'), docCtxMenu.docName);
              if (next && next.trim() && currentProjectId) {
                updateDoc(currentProjectId, docCtxMenu.docId, { name: next.trim() });
              }
              setDocCtxMenu(null);
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors hover:bg-[var(--bg-hover)]"
            style={{ color: 'var(--text-primary)' }}
          >
            <Edit2 className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
            {t('rename')}
          </button>
          <button
            type="button"
            onClick={() => {
              if (!currentProjectId) {
                setDocCtxMenu(null);
                return;
              }
              const source = project?.docs?.find((x) => x.id === docCtxMenu.docId);
              const copyName = t('copyOf', { name: docCtxMenu.docName || t('docsHeading') });
              const newId = createDoc(currentProjectId, copyName, source?.content ?? '');
              setCurrentSheet(null);
              setCurrentDoc(newId);
              setDocCtxMenu(null);
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors hover:bg-[var(--bg-hover)]"
            style={{ color: 'var(--text-primary)' }}
          >
            <Copy className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
            {t('duplicate')}
          </button>
          <div className="my-1 border-t" style={{ borderColor: 'var(--border-primary)' }} />
          <button
            type="button"
            onClick={() => {
              if (currentProjectId) {
                deleteDoc(currentProjectId, docCtxMenu.docId);
              }
              setDocCtxMenu(null);
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors hover:bg-[var(--bg-hover)]"
            style={{ color: 'var(--danger)' }}
          >
            <Trash2 className="w-4 h-4" />
            {t('ctxDelete')}
          </button>
        </div>
      )}
    </div>
  );
}
