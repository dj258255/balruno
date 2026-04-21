'use client';

/**
 * Track 4 — 뷰 스위처. 기본 뷰 6종 + 저장된 뷰 N개 (시트마다).
 *
 * - 기본 뷰 6종: grid/form/kanban/calendar/gallery/gantt
 * - 저장 뷰: 사용자가 + 버튼으로 현재 설정을 이름과 함께 저장
 * - 저장 뷰 클릭 시 type/group 등 설정 일괄 적용
 * - 우클릭으로 이름 변경/삭제
 */

import { useState } from 'react';
import { Table2, FileText, Columns3, Calendar, Image, GanttChart, Plus, Bookmark, X, Workflow } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ViewType, Sheet, SavedView } from '@/types';
import { useProjectStore } from '@/stores/projectStore';

interface ViewSwitcherProps {
  projectId: string;
  sheet: Sheet;
}

const VIEWS: Array<{ id: ViewType; labelKey: string; icon: typeof Table2 }> = [
  { id: 'grid', labelKey: 'views.grid', icon: Table2 },
  { id: 'form', labelKey: 'views.form', icon: FileText },
  { id: 'kanban', labelKey: 'views.kanban', icon: Columns3 },
  { id: 'calendar', labelKey: 'views.calendar', icon: Calendar },
  { id: 'gallery', labelKey: 'views.gallery', icon: Image },
  { id: 'gantt', labelKey: 'views.gantt', icon: GanttChart },
  { id: 'diagram', labelKey: 'views.diagram', icon: Workflow },
];

const VIEW_ICON: Record<ViewType, typeof Table2> = {
  grid: Table2, form: FileText, kanban: Columns3, calendar: Calendar, gallery: Image, gantt: GanttChart,
  diagram: Workflow,
};

export default function ViewSwitcher({ projectId, sheet }: ViewSwitcherProps) {
  const t = useTranslations();
  const updateSheet = useProjectStore((s) => s.updateSheet);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [newName, setNewName] = useState('');
  const [renaming, setRenaming] = useState<string | null>(null);

  const savedViews = sheet.savedViews ?? [];
  const activeSavedViewId = sheet.activeSavedViewId;
  const activeView = sheet.activeView ?? 'grid';

  const switchToBase = (id: ViewType) => {
    updateSheet(projectId, sheet.id, { activeView: id, activeSavedViewId: undefined });
  };

  const switchToSaved = (sv: SavedView) => {
    updateSheet(projectId, sheet.id, {
      activeView: sv.type,
      activeSavedViewId: sv.id,
      viewGroupColumnId: sv.groupColumnId,
      viewKanbanCoverColumnId: sv.kanbanCoverColumnId,
      viewKanbanFieldIds: sv.kanbanFieldIds,
      viewCalendarEndColumnId: sv.calendarEndColumnId,
      viewGanttEndColumnId: sv.ganttEndColumnId,
      viewGanttDependsColumnId: sv.ganttDependsColumnId,
    });
  };

  const saveCurrent = () => {
    const name = newName.trim();
    if (!name) return;
    const next: SavedView = {
      id: `view_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name,
      type: activeView,
      groupColumnId: sheet.viewGroupColumnId,
      kanbanCoverColumnId: sheet.viewKanbanCoverColumnId,
      kanbanFieldIds: sheet.viewKanbanFieldIds,
      calendarEndColumnId: sheet.viewCalendarEndColumnId,
      ganttEndColumnId: sheet.viewGanttEndColumnId,
      ganttDependsColumnId: sheet.viewGanttDependsColumnId,
    };
    updateSheet(projectId, sheet.id, {
      savedViews: [...savedViews, next],
      activeSavedViewId: next.id,
    });
    setNewName('');
    setShowSaveDialog(false);
  };

  const renameSaved = (id: string, newLabel: string) => {
    const trimmed = newLabel.trim();
    if (!trimmed) return;
    updateSheet(projectId, sheet.id, {
      savedViews: savedViews.map((v) => (v.id === id ? { ...v, name: trimmed } : v)),
    });
    setRenaming(null);
  };

  const deleteSaved = (id: string) => {
    updateSheet(projectId, sheet.id, {
      savedViews: savedViews.filter((v) => v.id !== id),
      activeSavedViewId: activeSavedViewId === id ? undefined : activeSavedViewId,
    });
  };

  return (
    <div
      role="tablist"
      aria-label="시트 뷰"
      className="flex items-center gap-0.5 px-2 py-1 border-b"
      style={{ borderColor: 'var(--border-primary)' }}
    >
      {/* 탭 영역만 가로 스크롤 — 저장 버튼/팝오버는 밖에 둬서 clip 방지 */}
      <div className="flex-1 min-w-0 flex items-center gap-0.5 overflow-x-auto">
      {/* 기본 뷰 6종 */}
      {VIEWS.map((view) => {
        const Icon = view.icon;
        const isActive = !activeSavedViewId && activeView === view.id;
        return (
          <button
            key={view.id}
            onClick={() => switchToBase(view.id)}
            role="tab"
            aria-selected={isActive}
            aria-label={`${t(view.labelKey as 'views.grid')} 뷰`}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs transition-colors flex-shrink-0"
            style={{
              background: isActive ? 'var(--bg-hover)' : 'transparent',
              color: isActive ? 'var(--text-primary)' : 'var(--text-tertiary)',
              fontWeight: isActive ? 600 : 400,
            }}
            aria-pressed={isActive}
          >
            <Icon className="w-3.5 h-3.5" />
            {t(view.labelKey as 'views.grid')}
          </button>
        );
      })}

      {savedViews.length > 0 && (
        <span className="mx-1 text-caption flex-shrink-0" style={{ color: 'var(--text-tertiary)' }}>|</span>
      )}

      {/* 저장된 뷰 */}
      {savedViews.map((sv) => {
        const Icon = VIEW_ICON[sv.type] ?? Table2;
        const isActive = activeSavedViewId === sv.id;
        return (
          <div key={sv.id} className="flex items-center group flex-shrink-0">
            {renaming === sv.id ? (
              <input
                autoFocus
                defaultValue={sv.name}
                onBlur={(e) => renameSaved(sv.id, e.currentTarget.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') renameSaved(sv.id, e.currentTarget.value);
                  if (e.key === 'Escape') setRenaming(null);
                }}
                className="text-xs px-1 py-0.5 rounded border bg-transparent w-24"
                style={{ borderColor: 'var(--accent)', color: 'var(--text-primary)' }}
              />
            ) : (
              <button
                onClick={() => switchToSaved(sv)}
                onDoubleClick={() => setRenaming(sv.id)}
                className="flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-md text-xs"
                style={{
                  background: isActive ? 'var(--bg-hover)' : 'transparent',
                  color: isActive ? 'var(--text-primary)' : 'var(--text-tertiary)',
                  fontWeight: isActive ? 600 : 400,
                }}
                aria-pressed={isActive}
                title="더블클릭으로 이름 변경"
              >
                <Bookmark className="w-3 h-3" />
                <Icon className="w-3 h-3" />
                <span>{sv.name}</span>
                <span
                  onClick={(e) => { e.stopPropagation(); deleteSaved(sv.id); }}
                  className="ml-0.5 p-0.5 opacity-0 group-hover:opacity-100 hover:bg-[var(--bg-tertiary)] rounded"
                  role="button"
                  aria-label="삭제"
                >
                  <X size={10} />
                </span>
              </button>
            )}
          </div>
        );
      })}

      </div>{/* /스크롤 영역 */}

      {/* + 저장 버튼 — 스크롤 영역 밖이라 popover clip 없음 */}
      <div className="relative flex-shrink-0">
        <button
          onClick={() => setShowSaveDialog((v) => !v)}
          className="flex items-center gap-1 px-1.5 py-1 rounded-md text-xs hover:bg-[var(--bg-hover)] ml-1"
          style={{ color: 'var(--text-tertiary)' }}
          title="현재 뷰 설정을 저장"
        >
          <Plus className="w-3 h-3" />
          뷰 저장
        </button>
        {showSaveDialog && (
          <div
            className="absolute top-full mt-1.5 right-0 z-30 rounded-lg shadow-xl border p-2 flex items-center gap-2 whitespace-nowrap"
            style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-primary)' }}
          >
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveCurrent();
                if (e.key === 'Escape') { setNewName(''); setShowSaveDialog(false); }
              }}
              placeholder="뷰 이름"
              className="text-xs px-2 py-1.5 rounded border bg-transparent w-40 outline-none focus:ring-2 focus:ring-[var(--accent)]/30 transition"
              style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
            />
            <button
              onClick={saveCurrent}
              disabled={!newName.trim()}
              className="text-xs px-3 py-1.5 rounded font-medium flex-shrink-0"
              style={{ background: 'var(--accent)', color: 'white', opacity: newName.trim() ? 1 : 0.5 }}
            >
              저장
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
