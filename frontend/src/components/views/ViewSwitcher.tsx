'use client';

/**
 * Track 4 — 뷰 스위처 (시트 상단 탭 바).
 *
 * Grid 는 기본. Form/Kanban/Calendar/Gallery/Gantt 는 별도 뷰 컴포넌트 렌더.
 * 활성 뷰는 sheet.activeView 에 저장 (Y.Doc).
 */

import { Table2, FileText, Columns3, Calendar, Image, GanttChart } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ViewType } from '@/types';

interface ViewSwitcherProps {
  activeView: ViewType;
  onChange: (view: ViewType) => void;
}

const VIEWS: Array<{ id: ViewType; labelKey: string; icon: typeof Table2 }> = [
  { id: 'grid', labelKey: 'views.grid', icon: Table2 },
  { id: 'form', labelKey: 'views.form', icon: FileText },
  { id: 'kanban', labelKey: 'views.kanban', icon: Columns3 },
  { id: 'calendar', labelKey: 'views.calendar', icon: Calendar },
  { id: 'gallery', labelKey: 'views.gallery', icon: Image },
  { id: 'gantt', labelKey: 'views.gantt', icon: GanttChart },
];

export default function ViewSwitcher({ activeView, onChange }: ViewSwitcherProps) {
  const t = useTranslations();
  return (
    <div className="flex items-center gap-0.5 px-2 py-1 border-b" style={{ borderColor: 'var(--border-primary)' }}>
      {VIEWS.map((view) => {
        const Icon = view.icon;
        const isActive = activeView === view.id;
        return (
          <button
            key={view.id}
            onClick={() => onChange(view.id)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs transition-colors"
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
    </div>
  );
}
