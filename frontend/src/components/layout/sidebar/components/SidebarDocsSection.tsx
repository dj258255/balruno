'use client';

/**
 * 사이드바 문서 섹션 — Phase A.
 *
 * 현재 프로젝트의 docs 리스트 렌더.
 * "+ 새 문서" 버튼 · 문서 클릭 시 currentDoc 설정.
 */

import { useState, useRef, useEffect } from 'react';
import { FileText, Plus, ChevronDown, ChevronRight, Trash2, Sparkles } from 'lucide-react';
import { useProjectStore } from '@/stores/projectStore';
import { DOC_TEMPLATES } from '@/lib/docTemplates';

interface SidebarDocsSectionProps {
  /** 내부 리스트 영역의 최대 높이 (px). 사이드바 리사이즈 핸들로 동적 조절. */
  maxHeight?: number;
}

export default function SidebarDocsSection({ maxHeight = 240 }: SidebarDocsSectionProps) {
  const currentProjectId = useProjectStore((s) => s.currentProjectId);
  const project = useProjectStore((s) =>
    s.projects.find((p) => p.id === currentProjectId)
  );
  const currentDocId = useProjectStore((s) => s.currentDocId);
  const setCurrentDoc = useProjectStore((s) => s.setCurrentDoc);
  const setCurrentSheet = useProjectStore((s) => s.setCurrentSheet);
  const createDoc = useProjectStore((s) => s.createDoc);
  const deleteDoc = useProjectStore((s) => s.deleteDoc);
  const [expanded, setExpanded] = useState(true);
  const [showTemplates, setShowTemplates] = useState(false);
  const templateMenuRef = useRef<HTMLDivElement>(null);

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
    const id = createDoc(currentProjectId, '새 문서', '');
    setCurrentSheet(null);
    setCurrentDoc(id);
  };

  const handleCreateFromTemplate = (templateId: string) => {
    if (!currentProjectId) return;
    const template = DOC_TEMPLATES.find((t) => t.id === templateId);
    if (!template) return;
    const id = createDoc(currentProjectId, template.name, template.content);
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
    if (window.confirm(`"${name}" 문서를 삭제할까요?`)) {
      deleteDoc(project.id, docId);
    }
  };

  return (
    <div className="border-t shrink-0 flex flex-col min-h-0" style={{ borderColor: 'var(--border-primary)' }}>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-1 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider hover:bg-[var(--bg-hover)] transition-colors shrink-0"
        style={{ color: 'var(--text-tertiary)' }}
      >
        {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        문서
        <span className="ml-auto text-[10px] opacity-60">{docs.length}</span>
      </button>

      {expanded && (
        <div className="px-2 pb-2 overflow-y-auto" style={{ maxHeight: `${maxHeight}px` }}>
          <div className="relative mb-1" ref={templateMenuRef}>
            <div className="flex gap-1">
              <button
                onClick={handleCreate}
                className="flex-1 flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-left hover:bg-[var(--bg-hover)] transition-colors"
                style={{ color: 'var(--accent)' }}
              >
                <Plus className="w-3.5 h-3.5" />
                새 문서
              </button>
              <button
                onClick={() => setShowTemplates((v) => !v)}
                className="flex items-center gap-1 px-2 py-1.5 rounded-md text-xs hover:bg-[var(--bg-hover)] transition-colors"
                title="템플릿으로 시작"
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
                <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider border-b" style={{ borderColor: 'var(--border-primary)', color: 'var(--text-tertiary)' }}>
                  GDD 장르
                </div>
                {DOC_TEMPLATES.filter((t) => t.category === 'genre').map((t) => (
                  <button
                    key={t.id}
                    onClick={() => handleCreateFromTemplate(t.id)}
                    className="w-full text-left px-2 py-1.5 text-xs hover:bg-[var(--bg-hover)]"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    <div>{t.name}</div>
                    <div className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>{t.description}</div>
                  </button>
                ))}
                <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider border-b border-t" style={{ borderColor: 'var(--border-primary)', color: 'var(--text-tertiary)' }}>
                  시스템
                </div>
                {DOC_TEMPLATES.filter((t) => t.category !== 'genre').map((t) => (
                  <button
                    key={t.id}
                    onClick={() => handleCreateFromTemplate(t.id)}
                    className="w-full text-left px-2 py-1.5 text-xs hover:bg-[var(--bg-hover)]"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    <div>{t.name}</div>
                    <div className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>{t.description}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {docs.length === 0 ? (
            <p className="text-[10px] italic px-2 py-1.5" style={{ color: 'var(--text-tertiary)' }}>
              GDD · 설계안 · 릴리스 노트를 여기에.
            </p>
          ) : (
            <div className="space-y-0.5">
              {docs.map((d) => {
                const isActive = d.id === currentDocId;
                return (
                  <button
                    key={d.id}
                    onClick={() => handleOpen(d.id)}
                    className="group w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-left transition-colors"
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
                    <FileText
                      className="w-3.5 h-3.5 flex-shrink-0"
                      style={{ color: isActive ? 'var(--accent)' : 'var(--text-secondary)' }}
                    />
                    <span className="flex-1 truncate">{d.name || '(제목 없음)'}</span>
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => handleDelete(e, d.id, d.name)}
                      className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-[var(--bg-primary)]"
                      aria-label="문서 삭제"
                    >
                      <Trash2 className="w-3 h-3" style={{ color: 'var(--text-tertiary)' }} />
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
