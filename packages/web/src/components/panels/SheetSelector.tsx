import React, { useState, useEffect, useRef, useMemo } from 'react';
import { FileSpreadsheet, FolderOpen, ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useProjectStore } from '@/stores/projectStore';
import type { Sheet } from '@/types';

import { useTranslations } from 'next-intl';
interface SheetSelectorProps {
  selectedSheetId: string | null;
  onSheetChange: (sheetId: string) => void;
  // 프로젝트 선택 지원 (선택적)
  selectedProjectId?: string | null;
  onProjectChange?: (projectId: string) => void;
  showProjectSelector?: boolean;
  hideSheetSelector?: boolean; // 시트 선택 숨기기 (프로젝트만 선택)
  label?: string;
  color?: string;
  className?: string;
  /**
   * 'card' (기본): glass-card + 아이콘 박스 + 가로 배치. 분석 패널용.
   * 'inline': 카드 없이 라벨 + 드롭다운 세로 배치. 엔티티 정의처럼 여러 step 중 하나일 때.
   */
  variant?: 'card' | 'inline';
}

export default function SheetSelector({
  selectedSheetId,
  onSheetChange,
  selectedProjectId,
  onProjectChange,
  showProjectSelector = false,
  hideSheetSelector = false,
  label,
  color = '#3db88a',
  className,
  variant = 'card',
}: SheetSelectorProps) {
  const t = useTranslations();
  const labelText = label ?? t('sheetSelector.analysisSheet');
  const { projects, currentProjectId } = useProjectStore();

  // 프로젝트 선택이 활성화된 경우 선택된 프로젝트 사용, 아니면 현재 프로젝트
  const effectiveProjectId = showProjectSelector && selectedProjectId ? selectedProjectId : currentProjectId;
  // 중복 id 방지 — Y.Doc race / 동기화 오류로 같은 프로젝트/시트가 두 번 들어올 수 있음
  const uniqueProjects = useMemo(() => {
    const seen = new Set<string>();
    return projects.filter((p) => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
  }, [projects]);
  const currentProject = uniqueProjects.find(p => p.id === effectiveProjectId);
  const sheets = useMemo(() => {
    const raw = currentProject?.sheets || [];
    const seen = new Set<string>();
    return raw.filter((s) => {
      if (seen.has(s.id)) return false;
      seen.add(s.id);
      return true;
    });
  }, [currentProject]);

  const [isProjectOpen, setIsProjectOpen] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const projectRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  const selectedSheet = sheets.find(s => s.id === selectedSheetId);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (projectRef.current && !projectRef.current.contains(event.target as Node)) {
        setIsProjectOpen(false);
      }
      if (sheetRef.current && !sheetRef.current.contains(event.target as Node)) {
        setIsSheetOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 프로젝트가 없으면 안내 메시지
  if (uniqueProjects.length === 0) {
    return (
      <div className={cn(variant === 'card' ? 'glass-card p-4' : 'p-3 rounded-lg', className)}
        style={variant === 'inline' ? { background: 'var(--bg-secondary)', color: 'var(--text-tertiary)' } : undefined}>
        <div className="flex items-center gap-2 text-sm" style={{ color: variant === 'inline' ? 'var(--text-tertiary)' : 'var(--text-secondary)' }}>
          <FolderOpen className="w-4 h-4" />
          <span>{t('sheetSelector.noProject')}</span>
        </div>
      </div>
    );
  }

  const isInline = variant === 'inline';

  return (
    <div className={cn(isInline ? 'space-y-2' : 'glass-card p-4', className)}>
      <div className={cn(isInline ? 'space-y-2' : 'flex items-center gap-3')}>
        {!isInline && (
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: `linear-gradient(135deg, ${color}, ${color}cc)` }}
          >
            <FileSpreadsheet className="w-4 h-4 text-white" />
          </div>
        )}

        <div className={cn('min-w-0', isInline ? 'space-y-2' : 'flex-1 flex gap-2')}>
          {/* 프로젝트 선택 */}
          {showProjectSelector && onProjectChange && (
            <div className="flex-1 min-w-0">
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                {t('sheetSelector.projectLabel')}
              </label>
              <div ref={projectRef} className="relative">
                <button
                  type="button"
                  onClick={() => setIsProjectOpen(!isProjectOpen)}
                  className="w-full glass-input flex items-center justify-between gap-2 text-sm px-3 py-2"
                  style={{ color: 'var(--text-primary)' }}
                >
                  <div className="flex items-center gap-2 truncate">
                    <FolderOpen className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--text-secondary)' }} />
                    <span className="truncate font-medium">
                      {currentProject?.name || t('sheetSelector.selectPlaceholder')}
                    </span>
                  </div>
                  <ChevronDown
                    className={cn('w-4 h-4 shrink-0 transition-transform', isProjectOpen && 'rotate-180')}
                    style={{ color: 'var(--text-secondary)' }}
                  />
                </button>
                {isProjectOpen && (
                  <div
                    className="absolute z-50 w-full mt-1 py-1 rounded-xl shadow-lg border overflow-hidden max-h-60 overflow-y-auto"
                    style={{
                      background: 'var(--bg-primary)',
                      borderColor: 'var(--border-primary)',
                    }}
                  >
                    {uniqueProjects.map((project) => (
                      <button
                        key={project.id}
                        type="button"
                        onClick={() => {
                          onProjectChange(project.id);
                          // 프로젝트 변경 시 첫 번째 시트 자동 선택
                          if (project.sheets.length > 0) {
                            onSheetChange(project.sheets[0].id);
                          }
                          setIsProjectOpen(false);
                        }}
                        className={cn(
                          'w-full px-3 py-2 text-left text-sm transition-colors flex items-center justify-between',
                          project.id === effectiveProjectId
                            ? 'font-medium'
                            : 'hover:bg-[var(--bg-secondary)]'
                        )}
                        style={{
                          color: project.id === effectiveProjectId ? color : 'var(--text-primary)',
                          background: project.id === effectiveProjectId ? `${color}15` : undefined,
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <FolderOpen className="w-3.5 h-3.5" style={{ color: 'var(--text-secondary)' }} />
                          <span className="truncate">{project.name}</span>
                          <span className="text-xs shrink-0" style={{ color: 'var(--text-tertiary)' }}>
                            {t('sheetSelector.sheetCountSuffix', { n: project.sheets.length })}
                          </span>
                        </div>
                        {project.id === effectiveProjectId && (
                          <Check className="w-4 h-4 shrink-0" style={{ color }} />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 시트 선택 */}
          {!hideSheetSelector && (
          <div className={showProjectSelector ? 'flex-1 min-w-0' : 'flex-1'}>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
              {labelText}
            </label>
            <div ref={sheetRef} className="relative">
              <button
                type="button"
                onClick={() => sheets.length > 0 && setIsSheetOpen(!isSheetOpen)}
                disabled={sheets.length === 0}
                className={cn(
                  'w-full glass-input flex items-center justify-between gap-2 text-sm px-3 py-2',
                  sheets.length === 0 && 'opacity-50 cursor-not-allowed'
                )}
                style={{ color: 'var(--text-primary)' }}
              >
                <div className="flex items-center gap-2 truncate">
                  <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--text-secondary)' }} />
                  <span className="truncate font-medium">
                    {sheets.length === 0
                      ? t('sheetSelector.noSheets')
                      : selectedSheet?.name || t('sheetSelector.selectSheetPlaceholder')}
                  </span>
                </div>
                <ChevronDown
                  className={cn('w-4 h-4 shrink-0 transition-transform', isSheetOpen && 'rotate-180')}
                  style={{ color: 'var(--text-secondary)' }}
                />
              </button>
              {isSheetOpen && sheets.length > 0 && (
                <div
                  className="absolute z-50 w-full mt-1 py-1 rounded-xl shadow-lg border overflow-hidden max-h-60 overflow-y-auto"
                  style={{
                    background: 'var(--bg-primary)',
                    borderColor: 'var(--border-primary)',
                  }}
                >
                  {sheets.map((sheet) => (
                    <button
                      key={sheet.id}
                      type="button"
                      onClick={() => {
                        onSheetChange(sheet.id);
                        setIsSheetOpen(false);
                      }}
                      className={cn(
                        'w-full px-3 py-2 text-left text-sm transition-colors flex items-center justify-between',
                        sheet.id === selectedSheetId
                          ? 'font-medium'
                          : 'hover:bg-[var(--bg-secondary)]'
                      )}
                      style={{
                        color: sheet.id === selectedSheetId ? color : 'var(--text-primary)',
                        background: sheet.id === selectedSheetId ? `${color}15` : undefined,
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet className="w-3.5 h-3.5" style={{ color: 'var(--text-secondary)' }} />
                        <span>{sheet.name}</span>
                        <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                          {t('sheetSelector.rowCountSuffix', { n: sheet.rows.length })}
                        </span>
                      </div>
                      {sheet.id === selectedSheetId && (
                        <Check className="w-4 h-4" style={{ color }} />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          )}
        </div>
      </div>
    </div>
  );
}

// 다중 시트 선택 버전
interface MultiSheetSelectorProps {
  selectedSheetIds: string[];
  onSheetChange: (sheetIds: string[]) => void;
  label?: string;
  color?: string;
  className?: string;
  maxSelection?: number;
}

export function MultiSheetSelector({
  selectedSheetIds,
  onSheetChange,
  label: labelProp,
  color = '#3db88a',
  className,
  maxSelection = 5,
}: MultiSheetSelectorProps) {
  const t = useTranslations();
  const label = labelProp ?? t('sheetSelector.compareSheet');
  const { projects, currentProjectId } = useProjectStore();
  const currentProject = projects.find(p => p.id === currentProjectId);
  const sheets = currentProject?.sheets || [];

  const [isOpen, setIsOpen] = useState(false);
  const selectRef = useRef<HTMLDivElement>(null);

  const selectedSheets = sheets.filter(s => selectedSheetIds.includes(s.id));

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleSheet = (sheetId: string) => {
    if (selectedSheetIds.includes(sheetId)) {
      onSheetChange(selectedSheetIds.filter(id => id !== sheetId));
    } else if (selectedSheetIds.length < maxSelection) {
      onSheetChange([...selectedSheetIds, sheetId]);
    }
  };

  if (sheets.length === 0) {
    return (
      <div className={cn('glass-card p-4', className)}>
        <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <FileSpreadsheet className="w-4 h-4" />
          <span>{t('sheetSelector.noSheetsInProject')}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('glass-card p-4', className)}>
      <div className="flex items-center gap-3">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: `linear-gradient(135deg, ${color}, ${color}cc)` }}
        >
          <FileSpreadsheet className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
            {label} ({selectedSheetIds.length}/{maxSelection})
          </label>
          <div ref={selectRef} className="relative">
            <button
              type="button"
              onClick={() => setIsOpen(!isOpen)}
              className="w-full glass-input flex items-center justify-between gap-2 text-sm px-3 py-2"
              style={{ color: 'var(--text-primary)' }}
            >
              <span className="truncate font-medium">
                {selectedSheets.length > 0
                  ? selectedSheets.map(s => s.name).join(', ')
                  : t('sheetSelector.selectSheetPlaceholder')}
              </span>
              <ChevronDown
                className={cn('w-4 h-4 shrink-0 transition-transform', isOpen && 'rotate-180')}
                style={{ color: 'var(--text-secondary)' }}
              />
            </button>
            {isOpen && (
              <div
                className="absolute z-50 w-full mt-1 py-1 rounded-xl shadow-lg border overflow-hidden max-h-60 overflow-y-auto"
                style={{
                  background: 'var(--bg-primary)',
                  borderColor: 'var(--border-primary)',
                }}
              >
                {sheets.map((sheet) => {
                  const isSelected = selectedSheetIds.includes(sheet.id);
                  const isDisabled = !isSelected && selectedSheetIds.length >= maxSelection;

                  return (
                    <button
                      key={sheet.id}
                      type="button"
                      onClick={() => !isDisabled && toggleSheet(sheet.id)}
                      disabled={isDisabled}
                      className={cn(
                        'w-full px-3 py-2 text-left text-sm transition-colors flex items-center justify-between',
                        isDisabled && 'opacity-40 cursor-not-allowed',
                        isSelected ? 'font-medium' : 'hover:bg-[var(--bg-secondary)]'
                      )}
                      style={{
                        color: isSelected ? color : 'var(--text-primary)',
                        background: isSelected ? `${color}15` : undefined,
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={cn(
                            'w-4 h-4 rounded border flex items-center justify-center transition-all',
                            isSelected ? 'border-transparent' : 'border-[var(--border-primary)]'
                          )}
                          style={{
                            background: isSelected ? color : 'var(--bg-tertiary)',
                          }}
                        >
                          {isSelected && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                        </div>
                        <span>{sheet.name}</span>
                        <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                          {t('sheetSelector.rowCountSuffix', { n: sheet.rows.length })}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
