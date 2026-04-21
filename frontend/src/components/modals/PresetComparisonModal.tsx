'use client';

import { useState, useMemo } from 'react';
import { X, GitCompare, ArrowRight, Plus, Minus, Edit3, ChevronDown, ChevronUp, Download, Camera, HelpCircle } from 'lucide-react';
import { useProjectStore } from '@/stores/projectStore';
import { compareSheets, createSnapshot, getChangeColor, formatDiff, type ComparisonResult } from '@/lib/presetComparison';
import type { Sheet } from '@/types';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { useTranslations } from 'next-intl';
import CustomSelect from '@/components/ui/CustomSelect';
import SheetSelector from '@/components/panels/SheetSelector';
import PanelShell, { HelpToggle } from '@/components/ui/PanelShell';

interface PresetComparisonModalProps {
  onClose: () => void;
  isPanel?: boolean;
  showHelp?: boolean;
  setShowHelp?: (value: boolean) => void;
}

export default function PresetComparisonModal({ onClose, isPanel = false, showHelp: externalShowHelp, setShowHelp: externalSetShowHelp }: PresetComparisonModalProps) {
  // ESC 키로 모달 닫기
  useEscapeKey(onClose);

  const t = useTranslations('presetComparison');
  const { projects, currentProjectId, currentSheetId } = useProjectStore();

  // 프로젝트 및 시트 선택 상태
  const [selectedProjectId, setSelectedProjectId] = useState<string>(currentProjectId || '');
  const [selectedSheetId, setSelectedSheetId] = useState<string>(currentSheetId || '');

  const currentProject = projects.find(p => p.id === selectedProjectId);
  const sheets = currentProject?.sheets || [];

  // 상태
  const [oldSheetId, setOldSheetId] = useState<string>('');
  const [newSheetId, setNewSheetId] = useState<string>('');
  const [snapshots, setSnapshots] = useState<Sheet[]>([]);
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [showUnchanged, setShowUnchanged] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [internalShowHelp, setInternalShowHelp] = useState(false);

  // 외부 props가 있으면 외부 상태 사용, 없으면 내부 상태 사용
  const showHelp = externalShowHelp !== undefined ? externalShowHelp : internalShowHelp;
  const setShowHelp = externalSetShowHelp || setInternalShowHelp;

  // 비교 가능한 소스 목록 (시트 + 스냅샷)
  const sources = useMemo(() => [
    ...sheets.map(s => ({ id: s.id, name: s.name, type: 'sheet' as const, data: s })),
    ...snapshots.map(s => ({ id: s.id, name: s.name, type: 'snapshot' as const, data: s })),
  ], [sheets, snapshots]);

  // 스냅샷 생성
  const handleCreateSnapshot = (sheetId: string) => {
    const sheet = sheets.find(s => s.id === sheetId);
    if (sheet) {
      const snapshot = createSnapshot(sheet);
      setSnapshots(prev => [...prev, snapshot]);
    }
  };

  // 비교 실행
  const handleCompare = () => {
    const oldSource = sources.find(s => s.id === oldSheetId);
    const newSource = sources.find(s => s.id === newSheetId);

    if (!oldSource || !newSource) return;

    // 이름 기반 매칭으로 비교 실행 (컬럼 이름, 행 이름 자동 탐지)
    // allSheets를 전달하여 수식 계산 시 다른 시트 참조 가능
    const comparisonResult = compareSheets(oldSource.data, newSource.data, {
      allSheets: sheets,
    });
    setResult(comparisonResult);
  };

  // 행 확장/축소 토글
  const toggleRow = (rowId: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(rowId)) {
        next.delete(rowId);
      } else {
        next.add(rowId);
      }
      return next;
    });
  };

  // 결과 내보내기
  const handleExport = () => {
    if (!result) return;

    const data = {
      summary: result.summary,
      columnStats: result.columnStats.map(cs => ({
        column: cs.columnName,
        oldAvg: cs.oldStats.avg.toFixed(2),
        newAvg: cs.newStats.avg.toFixed(2),
        change: formatDiff(cs.avgDiff, cs.avgDiffPercent),
      })),
      changes: result.rowChanges
        .filter(r => r.type !== 'unchanged')
        .map(r => ({
          row: r.rowName,
          type: r.type,
          cells: r.cellChanges
            .filter(c => c.diff !== null || c.oldValue !== c.newValue)
            .map(c => ({
              column: c.columnName,
              old: c.oldValue,
              new: c.newValue,
              change: formatDiff(c.diff, c.diffPercent),
            })),
        })),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `comparison_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 본문 — 모달/패널 공통으로 사용하는 내용부
  const body = (
    <>
      {/* 도움말 패널 */}
      {showHelp && (
            <div className="mb-4 p-3 rounded-lg animate-slideDown" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)' }}>
              <div className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>
                {t('helpDesc')}
              </div>
              <div className="space-y-2">
                <div className="p-2.5 rounded-lg" style={{ background: 'var(--bg-primary)', borderLeft: '3px solid #3b82f6' }}>
                  <span className="font-medium text-sm" style={{ color: '#3b82f6' }}>{t('helpSnapshotTitle')}</span>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{t('helpSnapshot')}</p>
                </div>
                <div className="p-2.5 rounded-lg" style={{ background: 'var(--bg-primary)', borderLeft: '3px solid #22c55e' }}>
                  <span className="font-medium text-sm" style={{ color: '#22c55e' }}>{t('helpCompareTitle')}</span>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{t('helpCompare')}</p>
                </div>
                <div className="p-2.5 rounded-lg" style={{ background: 'var(--bg-primary)', borderLeft: '3px solid #f59e0b' }}>
                  <span className="font-medium text-sm" style={{ color: '#f59e0b' }}>{t('helpExportTitle')}</span>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{t('helpExport')}</p>
                </div>
                <div className="p-2.5 rounded-lg" style={{ background: 'var(--bg-primary)', borderLeft: '3px solid #8b5cf6' }}>
                  <span className="font-medium text-sm" style={{ color: '#8b5cf6' }}>{t('helpMatchingTitle')}</span>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{t('helpMatching')}</p>
                </div>
              </div>
              <div className="mt-3 p-2.5 rounded-lg text-xs" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
                {t('helpUseCase')}
              </div>
            </div>
          )}
          {/* 프로젝트 선택 */}
          <SheetSelector
            selectedProjectId={selectedProjectId}
            onProjectChange={(projectId) => {
              setSelectedProjectId(projectId);
              setOldSheetId('');
              setNewSheetId('');
              setResult(null);
            }}
            showProjectSelector={true}
            hideSheetSelector={true}
            selectedSheetId={null}
            onSheetChange={() => {}}
            color="#6366f1"
          />

          {/* 비교 대상 선택 - 반응형 */}
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 sm:items-end">
            <div className="flex-1 min-w-0">
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                {t('before')}
              </label>
              <div className="flex gap-2">
                <div className="flex-1 min-w-0">
                  <CustomSelect
                    value={oldSheetId}
                    onChange={(v) => setOldSheetId(v)}
                    placeholder={t('select')}
                    options={sources.map(s => ({
                      value: s.id,
                      label: `[${s.type === 'snapshot' ? t('snapshot') : t('sheet')}] ${s.name}`,
                    }))}
                    size="md"
                  />
                </div>
                {oldSheetId && sources.find(s => s.id === oldSheetId)?.type === 'sheet' && (
                  <button
                    onClick={() => handleCreateSnapshot(oldSheetId)}
                    className="px-3 py-2 rounded-lg text-sm flex items-center gap-1 transition-colors shrink-0"
                    style={{
                      background: 'var(--bg-tertiary)',
                      border: '1px solid var(--border-primary)',
                      color: 'var(--text-secondary)'
                    }}
                    title="스냅샷 생성"
                  >
                    <Camera className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            <ArrowRight className="w-5 h-5 hidden sm:block shrink-0" style={{ color: 'var(--text-tertiary)' }} />

            <div className="flex-1 min-w-0">
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                {t('after')}
              </label>
              <div className="flex gap-2">
                <div className="flex-1 min-w-0">
                  <CustomSelect
                    value={newSheetId}
                    onChange={(v) => setNewSheetId(v)}
                    placeholder={t('select')}
                    options={sources.map(s => ({
                      value: s.id,
                      label: `[${s.type === 'snapshot' ? t('snapshot') : t('sheet')}] ${s.name}`,
                    }))}
                    size="md"
                  />
                </div>
                {newSheetId && sources.find(s => s.id === newSheetId)?.type === 'sheet' && (
                  <button
                    onClick={() => handleCreateSnapshot(newSheetId)}
                    className="px-3 py-2 rounded-lg text-sm flex items-center gap-1 transition-colors shrink-0"
                    style={{
                      background: 'var(--bg-tertiary)',
                      border: '1px solid var(--border-primary)',
                      color: 'var(--text-secondary)'
                    }}
                    title="스냅샷 생성"
                  >
                    <Camera className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* 비교 버튼 */}
          <button
            onClick={handleCompare}
            disabled={!oldSheetId || !newSheetId || oldSheetId === newSheetId}
            className="w-full py-2.5 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            style={{
              background: 'var(--accent)',
              color: 'white'
            }}
          >
            <GitCompare className="w-4 h-4" />
            {t('runComparison')}
          </button>

          {/* 결과 표시 */}
          {result && (
            <div className="space-y-5">
              {/* 요약 - 반응형 그리드 */}
              <div className="rounded-xl overflow-hidden" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)' }}>
                <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border-primary)' }}>
                  <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('changeSummary')}</div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4">
                  <div className="p-3 sm:p-4 text-center border-r border-b sm:border-b-0" style={{ borderColor: 'var(--border-primary)' }}>
                    <div className="text-xl sm:text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
                      {result.summary.totalRows}
                    </div>
                    <div className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>{t('totalRows')}</div>
                  </div>
                  <div className="p-3 sm:p-4 text-center border-b sm:border-b-0 sm:border-r" style={{ background: 'rgba(251, 191, 36, 0.05)', borderColor: 'var(--border-primary)' }}>
                    <div className="text-xl sm:text-2xl font-bold mb-1 flex items-center justify-center gap-1.5" style={{ color: '#d97706' }}>
                      <Edit3 className="w-4 h-4" />
                      {result.summary.changedRows}
                    </div>
                    <div className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>{t('modified')}</div>
                  </div>
                  <div className="p-3 sm:p-4 text-center border-r" style={{ background: 'rgba(34, 197, 94, 0.05)', borderColor: 'var(--border-primary)' }}>
                    <div className="text-xl sm:text-2xl font-bold mb-1 flex items-center justify-center gap-1.5" style={{ color: '#16a34a' }}>
                      <Plus className="w-4 h-4" />
                      {result.summary.addedRows}
                    </div>
                    <div className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>{t('added')}</div>
                  </div>
                  <div className="p-3 sm:p-4 text-center" style={{ background: 'rgba(239, 68, 68, 0.05)' }}>
                    <div className="text-xl sm:text-2xl font-bold mb-1 flex items-center justify-center gap-1.5" style={{ color: '#dc2626' }}>
                      <Minus className="w-4 h-4" />
                      {result.summary.removedRows}
                    </div>
                    <div className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>{t('removed')}</div>
                  </div>
                </div>
              </div>

              {/* 컬럼별 통계 변화 - 더 세련된 바 차트 스타일 */}
              <div className="rounded-xl overflow-hidden" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)' }}>
                <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border-primary)' }}>
                  <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('columnAvgChange')}</div>
                </div>
                <div className="p-4 space-y-3">
                  {result.columnStats
                    .filter(cs => cs.oldStats.count > 0 || cs.newStats.count > 0)
                    .slice(0, 10)
                    .map(cs => {
                      const isPositive = cs.avgDiff >= 0;
                      const barColor = isPositive ? '#4ade80' : '#f87171';
                      const textColor = isPositive ? '#16a34a' : '#dc2626';
                      const bgColor = isPositive ? 'rgba(74, 222, 128, 0.1)' : 'rgba(248, 113, 113, 0.1)';

                      return (
                        <div key={cs.columnId} className="group">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                              {cs.columnName}
                            </span>
                            <span className="text-sm font-mono font-semibold" style={{ color: cs.avgDiff !== 0 ? textColor : 'var(--text-tertiary)' }}>
                              {formatDiff(cs.avgDiff, cs.avgDiffPercent)}
                            </span>
                          </div>
                          <div className="h-3 rounded-full overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${Math.max(2, Math.min(100, Math.abs(cs.avgDiffPercent)))}%`,
                                background: cs.avgDiff !== 0 ? `linear-gradient(90deg, ${barColor}, ${barColor}dd)` : 'var(--border-secondary)',
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  {result.columnStats.filter(cs => cs.oldStats.count > 0 || cs.newStats.count > 0).length === 0 && (
                    <div className="text-center py-4 text-sm" style={{ color: 'var(--text-tertiary)' }}>
                      {t('noNumericColumns')}
                    </div>
                  )}
                </div>
              </div>

              {/* 행별 변경 사항 - 더 깔끔한 아코디언 스타일 */}
              <div className="rounded-xl overflow-hidden" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)' }}>
                <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border-primary)' }}>
                  <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('detailedChanges')}</div>
                  <label className="flex items-center gap-2 text-xs cursor-pointer select-none hover:opacity-80 transition-opacity" style={{ color: 'var(--text-secondary)' }}>
                    <div
                      className="w-4 h-4 rounded border-2 flex items-center justify-center transition-all"
                      style={{
                        borderColor: showUnchanged ? 'var(--accent)' : 'var(--border-secondary)',
                        background: showUnchanged ? 'var(--accent)' : 'transparent',
                      }}
                      onClick={() => setShowUnchanged(!showUnchanged)}
                    >
                      {showUnchanged && (
                        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <span onClick={() => setShowUnchanged(!showUnchanged)}>{t('showUnchanged')}</span>
                  </label>
                </div>

                <div className="max-h-80 overflow-y-auto divide-y" style={{ borderColor: 'var(--border-primary)' }}>
                  {result.rowChanges
                    .filter(r => showUnchanged || r.type !== 'unchanged')
                    .map(row => {
                      const typeConfig = {
                        added: { icon: Plus, color: '#16a34a', bg: 'rgba(34, 197, 94, 0.06)', label: t('added') },
                        removed: { icon: Minus, color: '#dc2626', bg: 'rgba(239, 68, 68, 0.06)', label: t('removed') },
                        modified: { icon: Edit3, color: '#d97706', bg: 'rgba(251, 191, 36, 0.06)', label: t('modified') },
                        unchanged: { icon: null, color: 'var(--text-tertiary)', bg: 'transparent', label: '' },
                      };
                      const config = typeConfig[row.type];
                      const IconComponent = config.icon;

                      return (
                        <div key={row.rowId} style={{ background: config.bg }}>
                          <button
                            onClick={() => row.type !== 'unchanged' && toggleRow(row.rowId)}
                            className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                            disabled={row.type === 'unchanged'}
                          >
                            <span className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: row.type !== 'unchanged' ? `${config.color}18` : 'transparent' }}>
                              {IconComponent && <IconComponent className="w-3.5 h-3.5" style={{ color: config.color }} />}
                            </span>
                            <span className="flex-1 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                              {row.rowName}
                            </span>
                            {row.type === 'modified' && (
                              <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: `${config.color}15`, color: config.color }}>
                                {t('cellsChanged', { count: row.cellChanges.filter(c => c.diff !== null || String(c.oldValue) !== String(c.newValue)).length })}
                              </span>
                            )}
                            {row.type !== 'unchanged' && (
                              <span className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
                                {expandedRows.has(row.rowId)
                                  ? <ChevronUp className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
                                  : <ChevronDown className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
                                }
                              </span>
                            )}
                          </button>

                          {/* 확장된 셀 변경 사항 - 반응형 테이블 스타일 */}
                          {expandedRows.has(row.rowId) && (
                            <div className="px-4 pb-4 pt-1">
                              <div className="rounded-lg overflow-hidden" style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-primary)' }}>
                                {row.cellChanges
                                  .filter(c => c.diff !== null || String(c.oldValue) !== String(c.newValue))
                                  .map((cell, idx, arr) => (
                                    <div
                                      key={cell.columnId}
                                      className="flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-3 px-3 py-2.5 text-sm"
                                      style={{ borderBottom: idx < arr.length - 1 ? '1px solid var(--border-primary)' : 'none' }}
                                    >
                                      <span className="w-full sm:w-20 font-medium truncate shrink-0" style={{ color: 'var(--text-secondary)' }}>
                                        {cell.columnName}
                                      </span>
                                      <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap flex-1 min-w-0">
                                        <span
                                          className="px-2 py-0.5 rounded text-xs font-mono truncate max-w-[120px] sm:max-w-none"
                                          style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#dc2626' }}
                                          title={cell.oldComputedValue !== null && cell.oldComputedValue !== undefined
                                            ? `${cell.oldComputedValue.toLocaleString()}${typeof cell.oldValue === 'string' && cell.oldValue.startsWith('=') ? ` (${cell.oldValue})` : ''}`
                                            : String(cell.oldValue ?? '-')}
                                        >
                                          {cell.oldComputedValue !== null && cell.oldComputedValue !== undefined
                                            ? `${cell.oldComputedValue.toLocaleString()}`
                                            : String(cell.oldValue ?? '-')}
                                        </span>
                                        <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4 shrink-0" style={{ color: 'var(--text-tertiary)' }} />
                                        <span
                                          className="px-2 py-0.5 rounded text-xs font-mono truncate max-w-[120px] sm:max-w-none"
                                          style={{ background: 'rgba(34, 197, 94, 0.1)', color: '#16a34a' }}
                                          title={cell.newComputedValue !== null && cell.newComputedValue !== undefined
                                            ? `${cell.newComputedValue.toLocaleString()}${typeof cell.newValue === 'string' && cell.newValue.startsWith('=') ? ` (${cell.newValue})` : ''}`
                                            : String(cell.newValue ?? '-')}
                                        >
                                          {cell.newComputedValue !== null && cell.newComputedValue !== undefined
                                            ? `${cell.newComputedValue.toLocaleString()}`
                                            : String(cell.newValue ?? '-')}
                                        </span>
                                        {cell.diff !== null && (
                                          <span className="text-xs font-mono font-semibold shrink-0 ml-auto" style={{
                                            color: cell.diff >= 0 ? '#16a34a' : '#dc2626'
                                          }}>
                                            {formatDiff(cell.diff, cell.diffPercent)}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}

                  {result.rowChanges.filter(r => showUnchanged || r.type !== 'unchanged').length === 0 && (
                    <div className="px-4 py-10 text-center">
                      <div className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
                        <Edit3 className="w-5 h-5" style={{ color: 'var(--text-tertiary)' }} />
                      </div>
                      <div className="text-sm font-medium" style={{ color: 'var(--text-tertiary)' }}>
                        {t('noChanges')}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

      {/* 시트가 없을 때 - 비교 대상 선택 영역 아래에 안내 메시지 */}
      {sheets.length === 0 && (
        <div
          className="rounded-xl p-4 text-center"
          style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)' }}
        >
          <GitCompare className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--text-tertiary)' }} />
          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
            {t('noSheets')}<br />
            {t('noSheetsDesc')}
          </p>
        </div>
      )}
    </>
  );

  const footer = result ? (
    <div className="flex items-center justify-end gap-3">
      <button
        onClick={handleExport}
        className="px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
        style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
      >
        <Download className="w-4 h-4" />
        {t('exportResults')}
      </button>
    </div>
  ) : null;

  // Panel 모드 — PanelShell 로 통합 (도움말 토글 + 닫기 버튼)
  if (isPanel) {
    return (
      <PanelShell
        title={t('title')}
        subtitle={t('subtitle')}
        icon={GitCompare}
        iconColor="#8b5cf6"
        onClose={onClose}
        bodyClassName="p-4 sm:p-6 space-y-4 sm:space-y-6 overflow-x-hidden scrollbar-slim"
        actions={
          <HelpToggle active={showHelp} onToggle={() => setShowHelp(!showHelp)} color="#8b5cf6" />
        }
        footer={footer ?? undefined}
      >
        {/* 스냅샷 inline hint — 도움말 토글 안 켜도 이건 상시 노출 */}
        <div
          className="flex items-start gap-2 p-2.5 rounded-lg text-[11px]"
          style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
        >
          <Camera className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: '#8b5cf6' }} />
          <div>
            <b style={{ color: 'var(--text-primary)' }}>스냅샷</b> = 시트의 현재 상태를 고정해 복사본으로 보관.
            원본이 바뀌어도 스냅샷은 그대로라 &ldquo;밸런스 패치 전 vs 후&rdquo; 비교 가능.
            시트 옆 <Camera className="w-3 h-3 inline mb-0.5" /> 버튼으로 생성.
          </div>
        </div>
        {body}
      </PanelShell>
    );
  }

  // 모달 모드 — 기존 카드 구조
  return (
    <div className="fixed inset-0 modal-overlay flex items-center justify-center z-[1100] p-4">
      <div className="card w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-scaleIn">
        <div
          className="flex items-center justify-between shrink-0 relative z-20 px-6 py-4 border-b"
          style={{ borderColor: 'var(--border-primary)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ background: 'var(--accent-light)' }}
            >
              <GitCompare className="w-5 h-5" style={{ color: 'var(--accent)' }} />
            </div>
            <div>
              <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                {t('title')}
              </h2>
              <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                {t('subtitle')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowHelp(!showHelp)}
              className="p-2 rounded-lg transition-colors hover:bg-[var(--bg-hover)]"
              aria-label={showHelp ? '도움말 숨기기' : '도움말 보기'}
              style={{ color: showHelp ? 'var(--accent)' : 'var(--text-tertiary)' }}
            >
              <HelpCircle className="w-5 h-5" />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg transition-colors hover:bg-[var(--bg-hover)]"
              style={{ color: 'var(--text-tertiary)' }}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 space-y-4 sm:space-y-6">
          {body}
        </div>

        {footer && (
          <div
            className="border-t px-6 py-4"
            style={{ borderColor: 'var(--border-primary)' }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
