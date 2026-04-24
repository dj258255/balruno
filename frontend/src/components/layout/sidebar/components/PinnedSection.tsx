'use client';

/**
 * PinnedSection — 사용자가 핀한 시트 목록을 평탄하게 보여주는 섹션.
 *
 * 규칙:
 *  - 핀이 하나도 없으면 섹션 자체 숨김 (빈 섹션 노이즈 방지)
 *  - 핀된 시트는 프로젝트 경로 없이 바로 클릭 → 해당 시트로 이동
 *  - 우클릭 시 시트 컨텍스트 메뉴 (핀 해제 / 이름 변경 / 시트 용도 / 복제 / 삭제)
 *  - onSheetContextMenu 미제공 시 fallback 으로 단순 unpin
 */

import { useState } from 'react';
import { Pin, ChevronDown, ChevronRight, FileSpreadsheet, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useSidebarPrefs } from '@/stores/sidebarPrefsStore';
import { useProjectStore } from '@/stores/projectStore';
import DocIconPicker from '@/components/docs/DocIconPicker';

interface PinnedSectionProps {
  /** 우클릭 시 시트 컨텍스트 메뉴 열기 — Sidebar 의 공통 핸들러와 공유 */
  onSheetContextMenu?: (
    e: React.MouseEvent,
    projectId: string,
    sheetId: string,
    sheetName: string,
    exportClassName?: string,
  ) => void;
}

export function PinnedSection({ onSheetContextMenu }: PinnedSectionProps = {}) {
  const t = useTranslations();
  const projects = useProjectStore((s) => s.projects);
  const currentSheetId = useProjectStore((s) => s.currentSheetId);
  const setCurrentProject = useProjectStore((s) => s.setCurrentProject);
  const setCurrentSheet = useProjectStore((s) => s.setCurrentSheet);
  const updateSheet = useProjectStore((s) => s.updateSheet);
  const { pinnedSheetIds, unpinSheet } = useSidebarPrefs();
  const [expanded, setExpanded] = useState(true);

  // 핀된 시트를 실제 시트 데이터로 해석 — 존재하지 않는 ID 는 조용히 스킵
  const pinnedEntries = pinnedSheetIds
    .map((sheetId) => {
      for (const project of projects) {
        const sheet = project.sheets.find((s) => s.id === sheetId);
        if (sheet) return { project, sheet };
      }
      return null;
    })
    .filter((entry): entry is { project: typeof projects[0]; sheet: typeof projects[0]['sheets'][0] } => entry !== null);

  if (pinnedEntries.length === 0) return null;

  return (
    <div className="border-b" style={{ borderColor: 'var(--border-primary)' }}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-1 px-3 py-1.5 text-overline hover:bg-[var(--bg-hover)] transition-colors"
        style={{ color: 'var(--text-tertiary)' }}
      >
        {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        <Pin className="w-3 h-3" />
        <span className="flex-1 text-left">{t('sidebar.pinned')}</span>
        <span className="text-caption" style={{ color: 'var(--text-tertiary)' }}>
          {pinnedEntries.length}
        </span>
      </button>

      {expanded && (
        <div className="px-2 pb-2 space-y-0.5">
          {pinnedEntries.map(({ project, sheet }) => {
            const isActive = currentSheetId === sheet.id;
            return (
              <div
                key={sheet.id}
                onClick={() => {
                  setCurrentProject(project.id);
                  setCurrentSheet(sheet.id);
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (onSheetContextMenu) {
                    onSheetContextMenu(e, project.id, sheet.id, sheet.name, sheet.exportClassName);
                  } else {
                    // fallback — prop 미제공 시 단순 unpin
                    unpinSheet(sheet.id);
                  }
                }}
                className="group flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer text-xs transition-colors"
                style={{
                  background: isActive ? 'var(--accent)' : 'transparent',
                  color: isActive ? 'white' : 'var(--text-primary)',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.background = 'var(--bg-hover)';
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.background = 'transparent';
                }}
                title={`${project.name} / ${sheet.name}`}
              >
                <span
                  className="flex-shrink-0"
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <DocIconPicker
                    icon={sheet.icon}
                    onChange={(emoji) => updateSheet(project.id, sheet.id, { icon: emoji })}
                    fallbackIcon={FileSpreadsheet}
                    fallbackColor={isActive ? 'white' : 'var(--accent)'}
                    size="sm"
                  />
                </span>
                <span className="flex-1 truncate">{sheet.name}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    unpinSheet(sheet.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-opacity"
                  title={t('sidebar.unpin')}
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
