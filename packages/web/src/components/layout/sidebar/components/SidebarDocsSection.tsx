/**
 * 사이드바 문서 섹션 — Phase A.
 *
 * 현재 프로젝트의 docs 리스트 렌더.
 * "+ 새 문서" 버튼 · 문서 클릭 시 currentDoc 설정.
 */

import { useState, useRef, useEffect, useLayoutEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Plus, ChevronDown, ChevronRight, Trash2, Sparkles, Edit2, Copy, FilePlus2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useProjectStore } from '@/stores/projectStore';
import { DOC_TEMPLATES } from '@/lib/docTemplates';
import DocIconPicker from '@/components/docs/DocIconPicker';
import type { Doc } from '@/types';

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
  const moveDoc = useProjectStore((s) => s.moveDoc);
  const toggleDocExpanded = useProjectStore((s) => s.toggleDocExpanded);
  const [expanded, setExpanded] = useState(true);
  const [showTemplates, setShowTemplates] = useState(false);
  const templateMenuRef = useRef<HTMLDivElement>(null);
  const templateAnchorRef = useRef<HTMLDivElement>(null);
  // popover 가 사이드바의 overflow:auto 에 잘리지 않도록 portal + fixed 좌표.
  // 트리거 아래 공간이 부족하면 위로 flip.
  const [templatePos, setTemplatePos] = useState<{
    left: number;
    width: number;
    top?: number;
    bottom?: number;
  } | null>(null);

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
      const target = e.target as Node;
      const insideAnchor = templateAnchorRef.current?.contains(target);
      const insideMenu = templateMenuRef.current?.contains(target);
      if (!insideAnchor && !insideMenu) setShowTemplates(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [showTemplates]);

  // popover 좌표 계산: 트리거 rect 기반 + viewport 하단 공간 부족 시 위로 flip.
  useLayoutEffect(() => {
    if (!showTemplates) {
      setTemplatePos(null);
      return;
    }
    const compute = () => {
      const anchor = templateAnchorRef.current;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      const GAP = 4;
      const ESTIMATED_HEIGHT = 320; // template 메뉴 평균 높이 — 실측치 대비 보수적
      const spaceBelow = window.innerHeight - rect.bottom - GAP;
      const flipUp = spaceBelow < ESTIMATED_HEIGHT && rect.top > spaceBelow;
      setTemplatePos({
        left: rect.left,
        width: rect.width,
        ...(flipUp
          ? { bottom: window.innerHeight - rect.top + GAP }
          : { top: rect.bottom + GAP }),
      });
    };
    compute();
    window.addEventListener('resize', compute);
    window.addEventListener('scroll', compute, true);
    return () => {
      window.removeEventListener('resize', compute);
      window.removeEventListener('scroll', compute, true);
    };
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

  const handleDelete = (docId: string, name: string) => {
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
          <div className="relative mb-1" ref={templateAnchorRef}>
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
            {showTemplates && templatePos && typeof document !== 'undefined' &&
              createPortal(
                <div
                  ref={templateMenuRef}
                  className="fixed rounded-lg shadow-lg border z-50 max-h-[60vh] overflow-y-auto"
                  style={{
                    left: templatePos.left,
                    width: templatePos.width,
                    top: templatePos.top,
                    bottom: templatePos.bottom,
                    background: 'var(--bg-primary)',
                    borderColor: 'var(--border-primary)',
                  }}
                >
                  <div className="px-2 py-1.5 text-overline border-b" style={{ borderColor: 'var(--border-primary)', color: 'var(--text-tertiary)' }}>
                    {t('templateGalleryGenre')}
                  </div>
                  {DOC_TEMPLATES.filter((tpl) => tpl.category === 'genre').map((tpl) => (
                    <button
                      key={tpl.id}
                      onClick={() => handleCreateFromTemplate(tpl.id)}
                      className="w-full text-left px-2 py-1.5 text-xs hover:bg-[var(--bg-hover)]"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      <div>{tpl.name}</div>
                      <div className="text-caption" style={{ color: 'var(--text-tertiary)' }}>{tpl.description}</div>
                    </button>
                  ))}
                  <div className="px-2 py-1.5 text-overline border-b border-t" style={{ borderColor: 'var(--border-primary)', color: 'var(--text-tertiary)' }}>
                    {t('templateGallerySystem')}
                  </div>
                  {DOC_TEMPLATES.filter((tpl) => tpl.category !== 'genre').map((tpl) => (
                    <button
                      key={tpl.id}
                      onClick={() => handleCreateFromTemplate(tpl.id)}
                      className="w-full text-left px-2 py-1.5 text-xs hover:bg-[var(--bg-hover)]"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      <div>{tpl.name}</div>
                      <div className="text-caption" style={{ color: 'var(--text-tertiary)' }}>{tpl.description}</div>
                    </button>
                  ))}
                </div>,
                document.body
              )
            }
          </div>

          {docs.length === 0 ? (
            <p className="text-caption italic px-2 py-1.5" style={{ color: 'var(--text-tertiary)' }}>
              {t('emptyDescription')}
            </p>
          ) : (
            <DocTree
              docs={docs}
              projectId={project.id}
              currentDocId={currentDocId}
              onOpen={handleOpen}
              onContextMenu={(e, d) => {
                e.preventDefault();
                e.stopPropagation();
                setDocCtxMenu({ x: e.clientX, y: e.clientY, docId: d.id, docName: d.name });
              }}
              onAddChild={(parentId) => {
                const id = createDoc(project.id, t('newDocDefault'), '', { parentId });
                setCurrentSheet(null);
                setCurrentDoc(id);
              }}
              onToggleExpanded={(docId) => toggleDocExpanded(project.id, docId)}
              onDeleteShort={(d) => handleDelete(d.id, d.name)}
              onIconChange={(docId, emoji) => updateDoc(project.id, docId, { icon: emoji })}
              onMove={(docId, parentId, position) => moveDoc(project.id, docId, parentId, position)}
              t={t}
            />
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
              if (!currentProjectId) {
                setDocCtxMenu(null);
                return;
              }
              const newId = createDoc(currentProjectId, t('newDocDefault'), '', {
                parentId: docCtxMenu.docId,
              });
              setCurrentSheet(null);
              setCurrentDoc(newId);
              setDocCtxMenu(null);
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors hover:bg-[var(--bg-hover)]"
            style={{ color: 'var(--text-primary)' }}
          >
            <FilePlus2 className="w-4 h-4" style={{ color: 'var(--accent)' }} />
            {t('addChild')}
          </button>
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

// ============================================================================
// DocTree — Notion 식 nested doc 사이드바 트리
// ============================================================================

interface DocTreeProps {
  docs: Doc[];
  projectId: string;
  currentDocId: string | null;
  onOpen: (docId: string) => void;
  onContextMenu: (e: React.MouseEvent, doc: Doc) => void;
  onAddChild: (parentId: string) => void;
  onToggleExpanded: (docId: string) => void;
  onDeleteShort: (doc: Doc) => void;
  onIconChange: (docId: string, emoji: string | undefined) => void;
  onMove: (docId: string, parentId: string | undefined, position?: number) => void;
  t: ReturnType<typeof useTranslations<'docs'>>;
}

function DocTree(props: DocTreeProps) {
  const childrenByParent = useMemo(() => {
    const map = new Map<string | undefined, Doc[]>();
    for (const d of props.docs) {
      const key = d.parentId;
      const list = map.get(key) ?? [];
      list.push(d);
      map.set(key, list);
    }
    // Sort siblings by position (then by createdAt for ties).
    for (const list of map.values()) {
      list.sort((a, b) => (a.position ?? a.createdAt) - (b.position ?? b.createdAt));
    }
    return map;
  }, [props.docs]);

  const roots = childrenByParent.get(undefined) ?? [];

  return (
    <div className="space-y-0.5">
      {roots.map((d) => (
        <DocTreeNode
          key={d.id}
          doc={d}
          depth={0}
          childrenByParent={childrenByParent}
          {...props}
        />
      ))}
    </div>
  );
}

interface DocTreeNodeProps extends DocTreeProps {
  doc: Doc;
  depth: number;
  childrenByParent: Map<string | undefined, Doc[]>;
}

function DocTreeNode({
  doc: d,
  depth,
  childrenByParent,
  currentDocId,
  onOpen,
  onContextMenu,
  onAddChild,
  onToggleExpanded,
  onDeleteShort,
  onIconChange,
  onMove,
  projectId,
  t,
  docs,
}: DocTreeNodeProps) {
  const isActive = d.id === currentDocId;
  const children = childrenByParent.get(d.id) ?? [];
  const expanded = d.isExpanded ?? true;
  const hasChildren = children.length > 0;

  const onDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('application/x-balruno-doc', d.id);
    e.dataTransfer.effectAllowed = 'move';
  };
  const onDragOver = (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes('application/x-balruno-doc')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const draggedId = e.dataTransfer.getData('application/x-balruno-doc');
    if (!draggedId || draggedId === d.id) return;
    // Prevent dropping into its own descendants.
    if (isAncestor(draggedId, d.id, childrenByParent)) return;
    onMove(draggedId, d.id, Date.now());
  };

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        draggable
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onClick={() => onOpen(d.id)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onOpen(d.id);
          }
        }}
        onContextMenu={(e) => onContextMenu(e, d)}
        className="group w-full flex items-center gap-1 pr-2 py-1 rounded-md text-xs transition-colors cursor-pointer"
        style={{
          paddingLeft: 8 + depth * 12,
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
        {/* 펼침 chevron — 자식 있을 때만 클릭 가능, 없으면 placeholder 칸 유지 */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (hasChildren) onToggleExpanded(d.id);
          }}
          className="flex-shrink-0 p-0.5 rounded hover:bg-[var(--bg-primary)]"
          style={{ visibility: hasChildren ? 'visible' : 'hidden' }}
          aria-label={expanded ? t('collapse') : t('expand')}
        >
          {expanded ? (
            <ChevronDown className="w-3 h-3" style={{ color: 'var(--text-tertiary)' }} />
          ) : (
            <ChevronRight className="w-3 h-3" style={{ color: 'var(--text-tertiary)' }} />
          )}
        </button>

        <DocIconPicker
          icon={d.icon}
          onChange={(emoji) => onIconChange(d.id, emoji)}
          size="sm"
          className="flex-shrink-0"
        />

        <span className="flex-1 truncate">{d.name || t('noTitlePlaceholder')}</span>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onAddChild(d.id);
          }}
          className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-[var(--bg-primary)]"
          aria-label={t('addChild')}
          title={t('addChild')}
        >
          <Plus className="w-3 h-3" style={{ color: 'var(--text-tertiary)' }} />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDeleteShort(d);
          }}
          className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-[var(--bg-primary)]"
          aria-label={t('delete')}
        >
          <Trash2 className="w-3 h-3" style={{ color: 'var(--text-tertiary)' }} />
        </button>
      </div>

      {expanded && hasChildren && (
        <div>
          {children.map((child) => (
            <DocTreeNode
              key={child.id}
              doc={child}
              depth={depth + 1}
              childrenByParent={childrenByParent}
              docs={docs}
              projectId={projectId}
              currentDocId={currentDocId}
              onOpen={onOpen}
              onContextMenu={onContextMenu}
              onAddChild={onAddChild}
              onToggleExpanded={onToggleExpanded}
              onDeleteShort={onDeleteShort}
              onIconChange={onIconChange}
              onMove={onMove}
              t={t}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function isAncestor(
  candidateAncestorId: string,
  nodeId: string,
  childrenByParent: Map<string | undefined, Doc[]>,
): boolean {
  const queue: string[] = [candidateAncestorId];
  while (queue.length > 0) {
    const parent = queue.shift()!;
    if (parent === nodeId) return true;
    const kids = childrenByParent.get(parent) ?? [];
    for (const k of kids) queue.push(k.id);
  }
  return false;
}
