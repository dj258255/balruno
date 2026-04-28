'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, X, Edit2, Copy, Check, LayoutTemplate, GripVertical, ChevronLeft, ChevronRight, XCircle, FileText, FileSpreadsheet } from 'lucide-react';
import DocIconPicker from '@/components/docs/DocIconPicker';
import { useProjectStore } from '@/stores/projectStore';
import type { Project } from '@/types';
import { TemplateSelector } from '@/components/panels';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

interface SheetTabsProps {
  project: Project;
}

const MIN_TAB_WIDTH = 80;
const MAX_TAB_WIDTH = 300;
const DEFAULT_TAB_WIDTH = 120;

export default function SheetTabs({ project }: SheetTabsProps) {
  const t = useTranslations();
  const {
    currentSheetId,
    openTabs,
    setCurrentSheet,
    createSheet,
    updateSheet,
    duplicateSheet,
    closeSheetTab,
    reorderOpenTabs,
    currentDocId,
    setCurrentDoc,
    closeDocTab,
    updateDoc,
  } = useProjectStore();

  const [editingSheetId, setEditingSheetId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [showNewSheet, setShowNewSheet] = useState(false);
  const [newSheetName, setNewSheetName] = useState('');
  const [newSheetClassName, setNewSheetClassName] = useState('');
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);

  // 탭 너비 상태
  const [tabWidths, setTabWidths] = useState<Record<string, number>>({});
  const [resizingTabId, setResizingTabId] = useState<string | null>(null);
  const [resizeStartX, setResizeStartX] = useState(0);
  const [resizeStartWidth, setResizeStartWidth] = useState(0);

  // 탭 드래그 상태
  const [draggedTabId, setDraggedTabId] = useState<string | null>(null);
  const [dragOverTabId, setDragOverTabId] = useState<string | null>(null);

  // 컨텍스트 메뉴 상태
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; sheetId: string; sheetName: string } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  // 스크롤 상태
  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // localStorage에서 탭 너비 불러오기
  useEffect(() => {
    const saved = localStorage.getItem('sheetTabWidths');
    if (saved) {
      try {
        setTabWidths(JSON.parse(saved));
      } catch {
        // ignore
      }
    }
  }, []);

  // 탭 너비 저장
  const saveTabWidths = useCallback((widths: Record<string, number>) => {
    localStorage.setItem('sheetTabWidths', JSON.stringify(widths));
  }, []);

  const getTabWidth = (sheetId: string) => {
    return tabWidths[sheetId] || DEFAULT_TAB_WIDTH;
  };

  // 리사이즈 시작
  const handleResizeStart = (e: React.MouseEvent, sheetId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setResizingTabId(sheetId);
    setResizeStartX(e.clientX);
    setResizeStartWidth(getTabWidth(sheetId));
  };

  // 리사이즈 중
  useEffect(() => {
    if (!resizingTabId) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - resizeStartX;
      const newWidth = Math.max(MIN_TAB_WIDTH, Math.min(MAX_TAB_WIDTH, resizeStartWidth + delta));
      setTabWidths(prev => ({
        ...prev,
        [resizingTabId]: newWidth,
      }));
    };

    const handleMouseUp = () => {
      setTabWidths(prev => {
        saveTabWidths(prev);
        return prev;
      });
      setResizingTabId(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizingTabId, resizeStartX, resizeStartWidth, saveTabWidths]);

  const handleStartEdit = (sheetId: string, name: string) => {
    setEditingSheetId(sheetId);
    setEditName(name);
  };

  const handleFinishEdit = () => {
    if (editingSheetId && editName.trim()) {
      updateSheet(project.id, editingSheetId, { name: editName.trim() });
    }
    setEditingSheetId(null);
    setEditName('');
  };

  const handleCreateSheet = () => {
    if (newSheetName.trim()) {
      createSheet(project.id, newSheetName.trim(), newSheetClassName.trim() || undefined);
      setNewSheetName('');
      setNewSheetClassName('');
      setShowNewSheet(false);
    }
  };

  // 열린 탭을 (sheet|doc) 객체와 함께 entry 로 materialize — 순서 유지
  type RenderableTab =
    | { kind: 'sheet'; id: string; sheet: NonNullable<ReturnType<typeof project.sheets.find>> }
    | { kind: 'doc'; id: string; doc: NonNullable<NonNullable<typeof project.docs>[number]> };

  const renderables: RenderableTab[] = openTabs
    .map((entry): RenderableTab | null => {
      if (entry.kind === 'sheet') {
        const sheet = project.sheets.find((s) => s.id === entry.id);
        return sheet ? { kind: 'sheet', id: entry.id, sheet } : null;
      }
      const doc = project.docs?.find((d) => d.id === entry.id);
      return doc ? { kind: 'doc', id: entry.id, doc } : null;
    })
    .filter((r): r is RenderableTab => r !== null);

  // 드래그할 때는 "entry key" 로 식별. 시트·문서 구분을 위해 prefix.
  const entryKey = (kind: 'sheet' | 'doc', id: string) => `${kind}:${id}`;

  // 탭 드래그 핸들러 — 같은 배열 안에서 시트/문서 자유롭게 재정렬
  const handleTabDragStart = (e: React.DragEvent, kind: 'sheet' | 'doc', id: string) => {
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.setData('application/x-tab', entryKey(kind, id));
    e.dataTransfer.effectAllowed = 'move';
    setDraggedTabId(entryKey(kind, id));
  };

  const handleTabDragOver = (e: React.DragEvent, kind: 'sheet' | 'doc', id: string) => {
    e.preventDefault();
    if (e.dataTransfer.types.includes('application/x-tab')) {
      setDragOverTabId(entryKey(kind, id));
    }
  };

  const handleTabDragLeave = () => {
    setDragOverTabId(null);
  };

  const handleTabDrop = (e: React.DragEvent, targetKind: 'sheet' | 'doc', targetId: string) => {
    e.preventDefault();
    const targetKey = entryKey(targetKind, targetId);
    if (draggedTabId && draggedTabId !== targetKey) {
      const fromIndex = openTabs.findIndex((t) => entryKey(t.kind, t.id) === draggedTabId);
      const toIndex = openTabs.findIndex((t) => entryKey(t.kind, t.id) === targetKey);
      if (fromIndex !== -1 && toIndex !== -1) {
        reorderOpenTabs(fromIndex, toIndex);
      }
    }
    setDraggedTabId(null);
    setDragOverTabId(null);
  };

  const handleTabDragEnd = () => {
    setDraggedTabId(null);
    setDragOverTabId(null);
  };

  // 컨텍스트 메뉴 핸들러
  const handleContextMenu = (e: React.MouseEvent, sheetId: string, sheetName: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, sheetId, sheetName });
  };

  // 컨텍스트 메뉴 외부 클릭 시 닫기
  useEffect(() => {
    if (!contextMenu) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [contextMenu]);

  // 스크롤 상태 업데이트
  const updateScrollState = useCallback(() => {
    const container = tabsContainerRef.current;
    if (!container) return;

    const { scrollLeft, scrollWidth, clientWidth } = container;
    // 스크롤 가능 여부 확인 (1px 여유 추가)
    const hasOverflow = scrollWidth > clientWidth + 1;
    setCanScrollLeft(hasOverflow && scrollLeft > 1);
    setCanScrollRight(hasOverflow && scrollLeft + clientWidth < scrollWidth - 1);
  }, []);

  // 스크롤 이벤트 및 리사이즈 감지
  useEffect(() => {
    const container = tabsContainerRef.current;
    if (!container) return;

    updateScrollState();
    container.addEventListener('scroll', updateScrollState);

    const resizeObserver = new ResizeObserver(updateScrollState);
    resizeObserver.observe(container);

    return () => {
      container.removeEventListener('scroll', updateScrollState);
      resizeObserver.disconnect();
    };
  }, [updateScrollState, renderables.length]);

  // 스크롤 함수
  const scrollTabs = (direction: 'left' | 'right') => {
    const container = tabsContainerRef.current;
    if (!container) return;

    const scrollAmount = 200;
    container.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  return (
    <>
      {/* 리사이즈 중 오버레이 */}
      {resizingTabId && (
        <div className="fixed inset-0 z-50" style={{ cursor: 'ew-resize' }} />
      )}

      <div
        className="flex items-center border-b min-h-[38px]"
        style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-primary)' }}
      >
        {/* 왼쪽 스크롤 버튼 - 맨 왼쪽 고정 */}
        <button
          onClick={() => scrollTabs('left')}
          className={cn(
            "flex-shrink-0 p-1.5 transition-all hover:bg-[var(--bg-hover)]",
            !canScrollLeft && "opacity-0 pointer-events-none w-0 p-0 overflow-hidden"
          )}
          style={{ color: 'var(--text-secondary)' }}
          disabled={!canScrollLeft}
          aria-label={t('sheet.tabScrollLeft')}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* 탭 + 액션 버튼 컨테이너 */}
        <div
          ref={tabsContainerRef}
          className="flex items-center gap-1 px-2 py-1 overflow-x-auto scrollbar-none flex-1 min-w-0"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
        {renderables.map((entry) => {
          const isSheet = entry.kind === 'sheet';
          const name = isSheet ? entry.sheet.name : (entry.doc.name || t('sheet.untitled'));
          const isActive = isSheet ? currentSheetId === entry.id : currentDocId === entry.id;
          const tabWidth = isSheet ? getTabWidth(entry.id) : Math.max(MIN_TAB_WIDTH, 180);
          const dragKey = entryKey(entry.kind, entry.id);
          const Icon = isSheet ? FileSpreadsheet : FileText;

          return (
            <div
              key={dragKey}
              draggable={!(isSheet && editingSheetId === entry.id)}
              onDragStart={(e) => handleTabDragStart(e, entry.kind, entry.id)}
              onDragOver={(e) => handleTabDragOver(e, entry.kind, entry.id)}
              onDragLeave={handleTabDragLeave}
              onDrop={(e) => handleTabDrop(e, entry.kind, entry.id)}
              onDragEnd={handleTabDragEnd}
              className={cn(
                "group flex items-center gap-1 pl-1 pr-3 py-1.5 rounded-t border border-b-0 cursor-pointer transition-colors relative",
                dragOverTabId === dragKey && "ring-2 ring-[var(--accent)]",
              )}
              style={{
                width: `${tabWidth}px`,
                minWidth: `${MIN_TAB_WIDTH}px`,
                maxWidth: `${MAX_TAB_WIDTH}px`,
                background: isActive ? 'var(--bg-primary)' : 'var(--bg-secondary)',
                borderColor: isActive ? 'var(--border-primary)' : 'transparent',
                marginBottom: isActive ? '-1px' : '0',
                opacity: draggedTabId === dragKey ? 0.5 : 1,
              }}
              onClick={() => (isSheet ? setCurrentSheet(entry.id) : setCurrentDoc(entry.id))}
              onContextMenu={isSheet ? (e) => handleContextMenu(e, entry.id, entry.sheet.name) : undefined}
              onMouseEnter={(e) => {
                if (!isActive && !draggedTabId) e.currentTarget.style.background = 'var(--bg-hover)';
              }}
              onMouseLeave={(e) => {
                if (!isActive && !draggedTabId) e.currentTarget.style.background = 'var(--bg-secondary)';
              }}
              title={name}
            >
              {/* 아이콘 — 시트·문서 둘 다 클릭으로 이모지 변경 가능 (각자 fallback 다름) */}
              <span
                className="flex-shrink-0"
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                draggable={false}
              >
                {isSheet ? (
                  <DocIconPicker
                    icon={entry.sheet.icon}
                    onChange={(emoji) => updateSheet(project.id, entry.id, { icon: emoji })}
                    fallbackIcon={FileSpreadsheet}
                    fallbackColor={isActive ? 'var(--accent)' : 'var(--text-secondary)'}
                    size="sm"
                  />
                ) : (
                  <DocIconPicker
                    icon={entry.doc.icon}
                    onChange={(emoji) => updateDoc(project.id, entry.id, { icon: emoji })}
                    size="sm"
                  />
                )}
              </span>

              {isSheet && editingSheetId === entry.id ? (
                <div className="flex items-center gap-1 flex-1 min-w-0">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onBlur={handleFinishEdit}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleFinishEdit();
                      if (e.key === 'Escape') {
                        setEditingSheetId(null);
                        setEditName('');
                      }
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="flex-1 min-w-0 px-1 py-0.5 text-sm border rounded"
                    style={{
                      background: 'var(--bg-primary)',
                      borderColor: 'var(--border-primary)',
                      color: 'var(--text-primary)'
                    }}
                    autoFocus
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleFinishEdit();
                    }}
                    style={{ color: 'var(--primary-green)' }}
                    aria-label={t('sheet.tabRenameConfirm')}
                  >
                    <Check className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <>
                  <span
                    className="text-sm flex-1 whitespace-nowrap overflow-hidden text-ellipsis"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {name}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isSheet) closeSheetTab(entry.id);
                      else closeDocTab(entry.id);
                    }}
                    className="p-0.5 rounded transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"
                    style={{ color: 'var(--text-tertiary)' }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = 'var(--text-primary)';
                      e.currentTarget.style.background = 'var(--bg-tertiary)';
                      e.currentTarget.style.border = '1px solid var(--border-secondary)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = 'var(--text-tertiary)';
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.border = '1px solid transparent';
                    }}
                    title={t('common.close')}
                    aria-label={t('sheet.tabCloseAria', { name })}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </>
              )}

              {/* 리사이즈 핸들 — 시트 탭만 */}
              {isSheet && (
                <div
                  className="absolute right-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-[var(--accent)] opacity-0 group-hover:opacity-50 transition-opacity"
                  onMouseDown={(e) => handleResizeStart(e, entry.id)}
                  onClick={(e) => e.stopPropagation()}
                />
              )}
            </div>
          );
        })}

          {/* 액션 버튼 - 탭들 바로 옆에 위치 */}
          {showNewSheet ? (
            <div className="flex items-center gap-1 flex-shrink-0">
              <input
                type="text"
                value={newSheetName}
                onChange={(e) => setNewSheetName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateSheet();
                  if (e.key === 'Escape') {
                    setShowNewSheet(false);
                    setNewSheetName('');
                    setNewSheetClassName('');
                  }
                }}
                placeholder={t('table.sheetName')}
                className="w-24 px-2 py-1 text-sm border rounded"
                style={{
                  background: 'var(--bg-primary)',
                  borderColor: 'var(--border-primary)',
                  color: 'var(--text-primary)'
                }}
                autoFocus
              />
              <input
                type="text"
                value={newSheetClassName}
                onChange={(e) => setNewSheetClassName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateSheet();
                  if (e.key === 'Escape') {
                    setShowNewSheet(false);
                    setNewSheetName('');
                    setNewSheetClassName('');
                  }
                }}
                placeholder={t('sheet.className')}
                className="w-24 px-2 py-1 text-sm border rounded"
                style={{
                  background: 'var(--bg-primary)',
                  borderColor: 'var(--border-primary)',
                  color: 'var(--text-tertiary)'
                }}
              />
              <button
                onClick={handleCreateSheet}
                className="px-2 py-1 text-sm rounded transition-colors"
                style={{ background: 'var(--primary-blue)', color: 'white' }}
              >
                {t('table.addSheet')}
              </button>
              <button
                onClick={() => {
                  setShowNewSheet(false);
                  setNewSheetName('');
                  setNewSheetClassName('');
                }}
                className="px-2 py-1 text-sm rounded transition-colors"
                style={{ background: 'var(--bg-hover)', color: 'var(--text-secondary)' }}
              >
                {t('common.cancel')}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={() => setShowNewSheet(true)}
                className="flex items-center gap-1 px-2 py-1.5 text-sm rounded transition-colors"
                style={{ color: 'var(--text-tertiary)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--text-primary)';
                  e.currentTarget.style.background = 'var(--bg-hover)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--text-tertiary)';
                  e.currentTarget.style.background = 'transparent';
                }}
                title={t('sheet.newSheet')}
                aria-label={t('sheet.tabAddSheet')}
              >
                <Plus className="w-4 h-4" />
              </button>
              <button
                onClick={() => setShowTemplateSelector(true)}
                className="flex items-center gap-1 px-2 py-1.5 text-sm rounded transition-colors"
                style={{ color: 'var(--primary-blue)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--primary-blue-light)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
                title={t('table.addFromTemplate')}
              >
                <LayoutTemplate className="w-4 h-4" />
                <span className="text-xs">{t('table.template')}</span>
              </button>
            </div>
          )}
        </div>

        {/* 오른쪽 스크롤 버튼 - 맨 오른쪽 고정 */}
        <button
          onClick={() => scrollTabs('right')}
          className={cn(
            "flex-shrink-0 p-1.5 transition-all hover:bg-[var(--bg-hover)]",
            !canScrollRight && "opacity-0 pointer-events-none w-0 p-0 overflow-hidden"
          )}
          style={{ color: 'var(--text-secondary)' }}
          disabled={!canScrollRight}
          aria-label={t('sheet.tabScrollRight')}
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        {/* 템플릿 선택 모달 */}
        {showTemplateSelector && (
          <TemplateSelector
            projectId={project.id}
            onClose={() => setShowTemplateSelector(false)}
            onSelect={(sheetId) => setCurrentSheet(sheetId)}
          />
        )}
      </div>

      {/* 탭 컨텍스트 메뉴 */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed z-50 min-w-[140px] py-1 rounded-lg shadow-lg border"
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
            background: 'var(--bg-primary)',
            borderColor: 'var(--border-primary)',
          }}
        >
          <button
            onClick={() => {
              handleStartEdit(contextMenu.sheetId, contextMenu.sheetName);
              setContextMenu(null);
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors text-left"
            style={{ color: 'var(--text-primary)' }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            <Edit2 className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
            {t('sheet.rename')}
          </button>
          <button
            onClick={() => {
              duplicateSheet(project.id, contextMenu.sheetId);
              setContextMenu(null);
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors text-left"
            style={{ color: 'var(--text-primary)' }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            <Copy className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
            {t('sheet.duplicate')}
          </button>

          {/* 구분선 */}
          <div className="my-1 border-t" style={{ borderColor: 'var(--border-primary)' }} />

          {/* 이 탭 닫기 */}
          <button
            onClick={() => {
              closeSheetTab(contextMenu.sheetId);
              setContextMenu(null);
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors text-left"
            style={{ color: 'var(--text-primary)' }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            <X className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
            {t('sheet.closeTab')}
          </button>

          {/* 다른 탭 모두 닫기 — 시트/문서 모두 */}
          <button
            onClick={() => {
              openTabs.forEach((t) => {
                if (t.kind === 'sheet' && t.id !== contextMenu.sheetId) closeSheetTab(t.id);
                else if (t.kind === 'doc') closeDocTab(t.id);
              });
              setContextMenu(null);
            }}
            disabled={openTabs.length <= 1}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors text-left disabled:opacity-40"
            style={{ color: 'var(--text-primary)' }}
            onMouseEnter={(e) => { if (openTabs.length > 1) e.currentTarget.style.background = 'var(--bg-hover)'; }}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            <X className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
            {t('sheet.closeOthers')}
          </button>

          {/* 모든 탭 닫기 — 시트/문서 모두 */}
          <button
            onClick={() => {
              [...openTabs].forEach((t) => {
                if (t.kind === 'sheet') closeSheetTab(t.id);
                else closeDocTab(t.id);
              });
              setContextMenu(null);
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors text-left"
            style={{ color: 'var(--status-error)' }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            <XCircle className="w-4 h-4" />
            {t('sheet.closeAll')}
          </button>
        </div>
      )}
    </>
  );
}
