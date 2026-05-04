import { useState, useMemo } from 'react';
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts';
import { X, Trash2, Download, Check, HelpCircle, ChevronDown, ChevronUp, BarChart3, PieChart, TrendingUp } from 'lucide-react';
import { useProjectStore } from '@/stores/projectStore';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';
import PanelShell, { HelpToggle } from '@/components/ui/PanelShell';
import SheetSelector from './SheetSelector';
import CustomSelect from '@/components/ui/CustomSelect';
import { computeSheetRows } from '@/lib/formulaEngine';
import type { CellValue } from '@/types';

interface ComparisonChartProps {
  onClose: () => void;
  isPanel?: boolean;
  showHelp?: boolean;
  setShowHelp?: (value: boolean) => void;
}

interface ComparisonItem {
  id: string;
  name: string;
  color: string;
  values: Record<string, number>;
}

const COLORS = [
  '#7c7ff2', // soft indigo
  '#e87aa8', // soft pink
  '#3db88a', // soft emerald
  '#e5a440', // soft amber
  '#5a9cf5', // soft blue
  '#9179f2', // soft purple
  '#4fc4d4', // soft cyan
  '#e5944a', // soft orange
];

const PANEL_COLOR = '#7c7ff2'; // 소프트 인디고

export default function ComparisonChart({ onClose, isPanel = false, showHelp: externalShowHelp, setShowHelp: externalSetShowHelp }: ComparisonChartProps) {
  const { projects, currentProjectId, currentSheetId, selectedRows, clearSelectedRows, deselectRow } = useProjectStore();
  const t = useTranslations('comparisonChart');
  const [internalShowHelp, setInternalShowHelp] = useState(false);
  const showHelp = externalShowHelp ?? internalShowHelp;
  const setShowHelp = externalSetShowHelp ?? setInternalShowHelp;

  // 프로젝트 및 시트 선택 상태
  const [selectedProjectId, setSelectedProjectId] = useState<string>(currentProjectId || '');
  const [selectedSheetId, setSelectedSheetId] = useState<string>(currentSheetId || '');

  const currentProject = projects.find(p => p.id === selectedProjectId);
  const selectedSheet = currentProject?.sheets.find(s => s.id === selectedSheetId);

  const [activeTab, setActiveTab] = useState<'radar' | 'bar' | 'histogram'>('radar');
  const [items, setItems] = useState<ComparisonItem[]>([]);
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [hoveredBar, setHoveredBar] = useState<{ stat: string; name: string; value: number; color: string } | null>(null);

  // 숫자 컬럼만 필터링
  const numericColumns = useMemo(() => {
    if (!selectedSheet) return [];
    return selectedSheet.columns.filter(
      (col) => col.type === 'general' || col.type === 'formula'
    );
  }, [selectedSheet]);

  // 수식 계산된 행 데이터
  const computedRows = useMemo(() => {
    if (!selectedSheet || !currentProject) return [];
    return computeSheetRows(selectedSheet, currentProject.sheets);
  }, [selectedSheet, currentProject]);

  // 행 데이터 (수식 계산 적용)
  const availableRows = useMemo(() => {
    if (!selectedSheet) return [];
    return selectedSheet.rows.map((row, index) => {
      const namePatterns = ['이름', 'name', 'Name', '캐릭터', '캐릭터명', '유닛', '아이템', '무기', '스킬'];
      const idPatterns = ['ID', 'id', 'Id'];

      let nameCol = selectedSheet.columns.find((c) => namePatterns.includes(c.name));
      if (!nameCol) {
        nameCol = selectedSheet.columns.find((c) => c.type === 'general');
      }

      const idCol = selectedSheet.columns.find((c) => idPatterns.includes(c.name));

      // 계산된 값 사용
      const computedCells = computedRows[index] || {};

      let name = '';
      if (nameCol && computedCells[nameCol.id]) {
        name = t('rowLabelWithName', { sheet: selectedSheet.name, index: index + 1, name: String(computedCells[nameCol.id]) });
      } else if (idCol && computedCells[idCol.id]) {
        name = t('rowLabelWithName', { sheet: selectedSheet.name, index: index + 1, name: String(computedCells[idCol.id]) });
      } else {
        name = t('rowLabel', { sheet: selectedSheet.name, index: index + 1 });
      }

      return { id: row.id, name, cells: computedCells as Record<string, CellValue> };
    });
  }, [selectedSheet, computedRows]);

  // 아이템 추가/제거
  const addItem = (rowId: string) => {
    const row = availableRows.find((r) => r.id === rowId);
    if (!row || items.find((i) => i.id === rowId)) return;

    const values: Record<string, number> = {};
    numericColumns.forEach((col) => {
      const val = row.cells[col.id];
      values[col.name] = typeof val === 'number' ? val : 0;
    });

    setItems([
      ...items,
      {
        id: row.id,
        name: row.name,
        color: COLORS[items.length % COLORS.length],
        values,
      },
    ]);
  };

  const removeItem = (id: string) => {
    setItems(items.filter((i) => i.id !== id));
  };

  const toggleColumn = (colName: string) => {
    if (selectedColumns.includes(colName)) {
      setSelectedColumns(selectedColumns.filter((c) => c !== colName));
    } else {
      setSelectedColumns([...selectedColumns, colName]);
    }
  };

  const uniqueSelectedColumns = useMemo(() => {
    return [...new Set(selectedColumns)];
  }, [selectedColumns]);

  // 레이더 차트 데이터
  const radarData = useMemo(() => {
    if (items.length === 0 || uniqueSelectedColumns.length === 0) return [];

    const maxValues: Record<string, number> = {};
    uniqueSelectedColumns.forEach((col) => {
      maxValues[col] = Math.max(...items.map((i) => i.values[col] || 0), 1);
    });

    return uniqueSelectedColumns.map((col, index) => {
      const point: Record<string, number | string> = { stat: col, _uniqueKey: `radar-${index}` };
      items.forEach((item) => {
        point[item.name] = ((item.values[col] || 0) / maxValues[col]) * 100;
        point[`${item.name}_raw`] = item.values[col] || 0;
      });
      return point;
    });
  }, [items, uniqueSelectedColumns]);

  // 바 차트 데이터
  const barData = useMemo(() => {
    if (items.length === 0 || uniqueSelectedColumns.length === 0) return [];

    return uniqueSelectedColumns.map((col, index) => {
      const point: Record<string, number | string> = { stat: col, _uniqueKey: `bar-${index}` };
      items.forEach((item) => {
        point[item.name] = item.values[col] || 0;
      });
      return point;
    });
  }, [items, uniqueSelectedColumns]);

  // 히스토그램 데이터 (수식 계산된 값 사용)
  const [histogramColumn, setHistogramColumn] = useState<string>('');
  const histogramData = useMemo(() => {
    if (!selectedSheet || !histogramColumn || computedRows.length === 0) return [];

    const col = selectedSheet.columns.find((c) => c.name === histogramColumn);
    if (!col) return [];

    const values = computedRows
      .map((row) => row[col.id])
      .filter((v): v is number => typeof v === 'number');

    if (values.length === 0) return [];

    const min = Math.min(...values);
    const max = Math.max(...values);
    const binCount = 10;
    const binSize = (max - min) / binCount || 1;

    const bins: { range: string; count: number; min: number; max: number }[] = [];
    for (let i = 0; i < binCount; i++) {
      const binMin = min + i * binSize;
      const binMax = min + (i + 1) * binSize;
      bins.push({
        range: `${binMin.toFixed(0)}-${binMax.toFixed(0)}`,
        min: binMin,
        max: binMax,
        count: 0,
      });
    }

    values.forEach((v) => {
      const binIndex = Math.min(Math.floor((v - min) / binSize), binCount - 1);
      if (bins[binIndex]) {
        bins[binIndex].count++;
      }
    });

    return bins;
  }, [selectedSheet, histogramColumn, computedRows]);

  const hasSheet = currentProject && selectedSheet;

  const tabs = [
    { id: 'radar' as const, label: t('tabs.radar'), icon: PieChart, color: PANEL_COLOR },
    { id: 'bar' as const, label: t('tabs.bar'), icon: BarChart3, color: '#3db88a' },
    { id: 'histogram' as const, label: t('tabs.histogram'), icon: TrendingUp, color: '#e5a440' },
  ];

  // 빈 상태 컴포넌트
  const EmptyState = () => (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center p-8">
        <div
          className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center"
          style={{ background: `linear-gradient(135deg, ${PANEL_COLOR}, ${PANEL_COLOR}cc)` }}
        >
          <PieChart className="w-8 h-8 text-white" />
        </div>
        <p className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>{t('noSheetSelected')}</p>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('selectSheetToCompare')}</p>
      </div>
    </div>
  );

  const modalHeader = (
    <div className="glass-panel-header">
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: `linear-gradient(135deg, ${PANEL_COLOR}, ${PANEL_COLOR}cc)` }}
        >
          <PieChart className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
            {t('fullTitle')}
          </h2>
          {hasSheet && (
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              {t('visualizeData', { sheetName: selectedSheet.name })}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setShowHelp(!showHelp)}
          className="glass-button flex items-center gap-1.5 !px-3"
          style={{ color: showHelp ? PANEL_COLOR : 'var(--text-secondary)' }}
        >
          <HelpCircle className="w-4 h-4" />
          <span className="text-sm">{t('help')}</span>
          {showHelp ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
        <button onClick={onClose} className="glass-button !p-2">
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );

  const body = (
    <>
      {/* 프로젝트/시트 선택 */}
        <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border-primary)' }}>
          <SheetSelector
            selectedProjectId={selectedProjectId}
            onProjectChange={(projectId) => {
              setSelectedProjectId(projectId);
              setItems([]);
              setSelectedColumns([]);
            }}
            showProjectSelector={true}
            selectedSheetId={selectedSheetId}
            onSheetChange={(sheetId) => {
              setSelectedSheetId(sheetId);
              setItems([]);
              setSelectedColumns([]);
            }}
            label={t('selectSheet')}
            color={PANEL_COLOR}
          />
        </div>

        {/* 모달 모드 도움말 */}
        {!isPanel && showHelp && (
          <div className="px-5 py-4 border-b animate-slideDown" style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-primary)' }}>
            <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
              {t('modalHelpDesc')}
            </p>
            <div className="grid grid-cols-3 gap-3 mb-3">
              {tabs.map((tab) => (
                <div key={tab.id} className="glass-card p-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <tab.icon className="w-4 h-4" style={{ color: tab.color }} />
                    <span className="font-medium text-sm" style={{ color: tab.color }}>{tab.label}</span>
                  </div>
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {tab.id === 'radar' && t('radarUseCase')}
                    {tab.id === 'bar' && t('barUseCase')}
                    {tab.id === 'histogram' && t('histogramUseCase')}
                  </p>
                </div>
              ))}
            </div>
            <div className="glass-section p-2.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
              {t('usageGuide')}
            </div>
          </div>
        )}

        {/* 탭 */}
        {hasSheet && (
          <div className="flex gap-1 px-4 py-2 border-b" style={{ borderColor: 'var(--border-primary)' }}>
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all',
                    isActive && 'shadow-sm'
                  )}
                  style={{
                    background: isActive ? `${tab.color}15` : 'transparent',
                    color: isActive ? tab.color : 'var(--text-secondary)',
                  }}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        )}

        {/* 시트에서 선택된 데이터 불러오기 */}
        {hasSheet && selectedRows.length > 0 && (activeTab === 'radar' || activeTab === 'bar') && (
          <div className="px-5 py-3 border-b" style={{ background: `${PANEL_COLOR}08`, borderColor: 'var(--border-primary)' }}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-sm" style={{ color: PANEL_COLOR }}>
                <Download className="w-4 h-4" />
                <span className="font-medium">{t('selectedData', { count: selectedRows.length })}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    selectedRows.forEach((row, index) => {
                      if (!items.find((i) => i.id === row.rowId)) {
                        const values: Record<string, number> = {};
                        Object.entries(row.values).forEach(([key, val]) => {
                          if (typeof val === 'number') {
                            values[key] = val;
                          } else {
                            const num = parseFloat(String(val));
                            if (!isNaN(num)) values[key] = num;
                          }
                        });
                        const rowIdx = selectedSheet?.rows.findIndex(r => r.id === row.rowId) ?? -1;
                        const itemName = `${selectedSheet?.name || t('sheet')} - ${t('rowNum', { num: rowIdx + 1 })}`;
                        setItems((prev) => [
                          ...prev,
                          {
                            id: row.rowId,
                            name: itemName,
                            color: COLORS[(prev.length + index) % COLORS.length],
                            values,
                          },
                        ]);
                      }
                    });
                    const numCols = Object.keys(selectedRows[0]?.values || {}).filter((k) => {
                      const val = selectedRows[0]?.values[k];
                      return typeof val === 'number' || !isNaN(parseFloat(String(val)));
                    });
                    if (selectedColumns.length === 0 && numCols.length > 0) {
                      setSelectedColumns(numCols.slice(0, 6));
                    }
                  }}
                  className="glass-button-primary !px-3 !py-1.5 text-sm"
                >
                  {t('addAll')}
                </button>
                <button
                  onClick={clearSelectedRows}
                  className="text-sm font-medium"
                  style={{ color: PANEL_COLOR }}
                >
                  {t('clearSelection')}
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {selectedRows.map((row) => {
                const isAdded = items.some((i) => i.id === row.rowId);
                const rowIndex = selectedSheet?.rows.findIndex(r => r.id === row.rowId) ?? -1;
                const displayName = `${selectedSheet?.name || t('sheet')} - ${t('rowNum', { num: rowIndex + 1 })}`;
                return (
                  <div
                    key={row.rowId}
                    className="glass-badge flex items-center gap-2 !py-1.5"
                    style={{ background: isAdded ? 'rgba(34, 197, 94, 0.1)' : undefined }}
                  >
                    {isAdded && <Check className="w-3 h-3" style={{ color: '#3db88a' }} />}
                    <span className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{displayName}</span>
                    {!isAdded && (
                      <button
                        onClick={() => {
                          const values: Record<string, number> = {};
                          Object.entries(row.values).forEach(([key, val]) => {
                            if (typeof val === 'number') {
                              values[key] = val;
                            } else {
                              const num = parseFloat(String(val));
                              if (!isNaN(num)) values[key] = num;
                            }
                          });
                          setItems((prev) => [
                            ...prev,
                            {
                              id: row.rowId,
                              name: displayName,
                              color: COLORS[prev.length % COLORS.length],
                              values,
                            },
                          ]);
                        }}
                        className="px-2 py-0.5 rounded-lg text-sm font-medium"
                        style={{ background: PANEL_COLOR, color: 'white' }}
                      >
                        {t('add')}
                      </button>
                    )}
                    <button onClick={() => deselectRow(row.rowId)} style={{ color: 'var(--text-secondary)' }}>
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 패널 모드 도움말 */}
        {isPanel && showHelp && (
          <div className="glass-card m-4 p-4 animate-slideDown space-y-3">
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: `linear-gradient(135deg, ${PANEL_COLOR}, ${PANEL_COLOR}cc)` }}
              >
                <PieChart className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{t('title')}</p>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('helpDesc')}</p>
              </div>
            </div>
            <div className="space-y-2">
              {tabs.map((tab) => (
                <div key={tab.id} className="glass-section p-2.5" style={{ borderLeft: `3px solid ${tab.color}` }}>
                  <div className="flex items-center gap-2">
                    <tab.icon className="w-3.5 h-3.5" style={{ color: tab.color }} />
                    <span className="font-medium text-sm" style={{ color: tab.color }}>{tab.label}</span>
                  </div>
                  <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                    {tab.id === 'radar' && t('helpRadar')}
                    {tab.id === 'bar' && t('helpBar')}
                    {tab.id === 'histogram' && t('helpHistogram')}
                  </p>
                </div>
              ))}
            </div>
            <div className="glass-divider" />
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('helpUsage')}</p>
          </div>
        )}

        {/* 시트가 없으면 빈 상태 표시 */}
        {!hasSheet ? (
          <EmptyState />
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
            {/* 설정 영역 - 레이더/바 차트용 */}
            {(activeTab === 'radar' || activeTab === 'bar') && (
              <>
                {/* 비교 대상 선택 */}
                <div className="mb-4">
                  <div className="flex items-center gap-3 mb-2">
                    <h4 className="font-semibold text-sm" style={{ color: 'var(--text-secondary)' }}>{t('compareTarget')}</h4>
                    <CustomSelect
                      value=""
                      onChange={(v) => v && addItem(v)}
                      options={[
                        { value: '', label: t('addTarget') },
                        ...availableRows
                          .filter((r) => !items.find((i) => i.id === r.id))
                          .map((row) => ({ value: row.id, label: row.name }))
                      ]}
                      color={PANEL_COLOR}
                      size="sm"
                      className="flex-1 max-w-xs"
                      maxHeight="none"
                    />
                    {items.length > 0 && (
                      <span className="glass-badge text-sm px-2 py-1" style={{ color: 'var(--text-secondary)' }}>
                        {t('itemCount', { count: items.length })}
                      </span>
                    )}
                  </div>

                  {/* 비교 대상 목록 */}
                  {items.length > 0 && (
                    <div className="flex gap-2 flex-wrap">
                      {items.map((item) => (
                        <div
                          key={item.id}
                          className="glass-card flex items-center gap-2 px-2.5 py-1.5 group"
                          style={{ borderLeft: `3px solid ${item.color}` }}
                        >
                          <span
                            className="text-sm font-medium"
                            style={{ color: 'var(--text-primary)' }}
                          >
                            {item.name}
                          </span>
                          <button
                            onClick={() => removeItem(item.id)}
                            className="p-0.5 rounded transition-all opacity-50 hover:opacity-100"
                            style={{ color: '#e86161' }}
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 비교 항목 (컬럼) 선택 - 가로 배치 */}
                <div>
                  <h4 className="font-semibold text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>{t('compareItems')}</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {numericColumns.map((col) => {
                      const isChecked = selectedColumns.includes(col.name);
                      return (
                        <label
                          key={col.id}
                          className={cn(
                            'flex items-center gap-2 text-sm cursor-pointer py-1.5 px-3 rounded-lg transition-all',
                            isChecked ? 'glass-card' : 'hover:bg-black/5 dark:hover:bg-white/5'
                          )}
                          style={{
                            color: 'var(--text-primary)',
                            background: isChecked ? `${PANEL_COLOR}15` : undefined,
                            border: isChecked ? `1px solid ${PANEL_COLOR}40` : '1px solid transparent'
                          }}
                        >
                          <div
                            className="w-3.5 h-3.5 rounded border-2 flex items-center justify-center transition-all flex-shrink-0"
                            style={{
                              background: isChecked ? PANEL_COLOR : 'transparent',
                              borderColor: isChecked ? PANEL_COLOR : 'var(--border-secondary)',
                            }}
                          >
                            {isChecked && <Check className="w-2 h-2 text-white" />}
                          </div>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleColumn(col.name)}
                            className="sr-only"
                          />
                          <span className="font-medium">{col.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {/* 설정 영역 - 히스토그램용 */}
            {activeTab === 'histogram' && (
              <>
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-sm" style={{ color: 'var(--text-secondary)' }}>{t('columnToAnalyze')}</h4>
                    <CustomSelect
                      value={histogramColumn}
                      onChange={setHistogramColumn}
                      options={[
                        { value: '', label: t('select') },
                        ...numericColumns.map((col) => ({ value: col.name, label: col.name }))
                      ]}
                      color="#e5a440"
                      size="sm"
                    />
                  </div>

                  {histogramColumn && histogramData.length > 0 && (
                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1.5">
                        <span style={{ color: 'var(--text-secondary)' }}>{t('totalCount')}:</span>
                        <span className="font-bold" style={{ color: 'var(--text-primary)' }}>{selectedSheet.rows.length}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span style={{ color: 'var(--text-secondary)' }}>{t('minimum')}:</span>
                        <span className="font-bold" style={{ color: '#3db88a' }}>{Math.min(...histogramData.map((d) => d.min)).toFixed(0)}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span style={{ color: 'var(--text-secondary)' }}>{t('maximum')}:</span>
                        <span className="font-bold" style={{ color: '#e86161' }}>{Math.max(...histogramData.map((d) => d.max)).toFixed(0)}</span>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* 차트 영역 */}
            {activeTab === 'radar' && (
                  <>
                    {items.length === 0 || uniqueSelectedColumns.length === 0 ? (
                      <div className="flex-1 flex items-center justify-center">
                        <div className="text-center glass-card p-6">
                          <PieChart className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--text-secondary)' }} />
                          <p className="font-medium" style={{ color: 'var(--text-secondary)' }}>{t('selectTargetAndItems')}</p>
                          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{t('recommendMinimum')}</p>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div style={{ minHeight: '350px', height: '100%' }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <RadarChart data={radarData}>
                              <PolarGrid stroke="var(--border-primary)" />
                              <PolarAngleAxis dataKey="stat" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
                              <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                              {items.map((item) => (
                                <Radar
                                  key={item.id}
                                  name={item.name}
                                  dataKey={item.name}
                                  stroke={item.color}
                                  fill={item.color}
                                  fillOpacity={0.2}
                                />
                              ))}
                              <Tooltip formatter={(value: number) => [`${value.toFixed(0)}%`]} />
                            </RadarChart>
                          </ResponsiveContainer>
                        </div>
                        {/* Legend */}
                        <div className="shrink-0 flex flex-wrap justify-center items-center gap-3 pt-3 border-t" style={{ borderColor: 'var(--border-primary)' }}>
                          {items.map((item) => (
                            <div key={item.id} className="flex items-center gap-1.5">
                              <div className="w-3 h-3 rounded-md shrink-0" style={{ background: item.color }} />
                              <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{item.name}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </>
                )}

                {activeTab === 'bar' && (
                  <>
                    {items.length === 0 || uniqueSelectedColumns.length === 0 ? (
                      <div className="flex-1 flex items-center justify-center">
                        <div className="text-center glass-card p-6">
                          <BarChart3 className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--text-secondary)' }} />
                          <p className="font-medium" style={{ color: 'var(--text-secondary)' }}>{t('selectTargetAndItems')}</p>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="relative" style={{ minHeight: '350px', height: '100%' }} onMouseLeave={() => setHoveredBar(null)}>
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={barData}>
                              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" />
                              <XAxis dataKey="stat" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
                              <YAxis tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
                              {items.map((item) => (
                                <Bar
                                  key={item.id}
                                  dataKey={item.name}
                                  fill={item.color}
                                  radius={[4, 4, 0, 0]}
                                  onMouseEnter={(data) => {
                                    if (data && data.payload) {
                                      setHoveredBar({
                                        stat: data.payload.stat,
                                        name: item.name,
                                        value: data.payload[item.name] as number,
                                        color: item.color
                                      });
                                    }
                                  }}
                                  onMouseLeave={() => setHoveredBar(null)}
                                >
                                  {barData.map((entry, index) => (
                                    <Cell
                                      key={`cell-${index}`}
                                      fillOpacity={hoveredBar ? (hoveredBar.name === item.name && hoveredBar.stat === entry.stat ? 1 : 0.4) : 1}
                                      style={{ cursor: 'pointer', transition: 'fill-opacity 0.15s' }}
                                    />
                                  ))}
                                </Bar>
                              ))}
                            </BarChart>
                          </ResponsiveContainer>
                          {/* Custom Tooltip - 해당 막대만 표시 */}
                          {hoveredBar && (
                            <div
                              className="absolute pointer-events-none z-10"
                              style={{
                                top: '50%',
                                left: '50%',
                                transform: 'translate(-50%, -100%)',
                              }}
                            >
                              <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-primary)', borderRadius: '12px', padding: '8px 12px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '4px' }}>{hoveredBar.stat}</p>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: hoveredBar.color }} />
                                  <span style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: 600 }}>{hoveredBar.name}: {hoveredBar.value.toLocaleString()}</span>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                        {/* Legend */}
                        <div className="shrink-0 flex flex-wrap justify-center items-center gap-3 pt-3 border-t" style={{ borderColor: 'var(--border-primary)' }}>
                          {items.map((item) => (
                            <div key={item.id} className="flex items-center gap-1.5">
                              <div className="w-3 h-3 rounded-md shrink-0" style={{ background: item.color }} />
                              <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{item.name}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </>
                )}

                {activeTab === 'histogram' && (
                  <>
                    {!histogramColumn ? (
                      <div className="flex-1 flex items-center justify-center">
                        <div className="text-center glass-card p-6">
                          <TrendingUp className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--text-secondary)' }} />
                          <p className="font-medium" style={{ color: 'var(--text-secondary)' }}>{t('selectColumnToAnalyze')}</p>
                        </div>
                      </div>
                    ) : histogramData.length === 0 ? (
                      <div className="flex-1 flex items-center justify-center">
                        <div className="text-center glass-card p-6">
                          <TrendingUp className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--text-secondary)' }} />
                          <p className="font-medium" style={{ color: 'var(--text-secondary)' }}>{t('noNumericData')}</p>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="glass-card px-4 py-2 mb-3 inline-flex items-center gap-2 self-start">
                          <TrendingUp className="w-4 h-4" style={{ color: '#e5a440' }} />
                          <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('distribution', { column: histogramColumn })}</span>
                        </div>
                        <div style={{ minHeight: '300px', height: '100%' }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={histogramData}>
                              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" />
                              <XAxis dataKey="range" tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} angle={-45} textAnchor="end" height={50} />
                              <YAxis tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} />
                              <Tooltip
                                formatter={(value: number) => [`${value}${t('count')}`, t('count')]}
                                labelFormatter={(label) => `${t('range')}: ${label}`}
                                contentStyle={{ background: 'var(--bg-primary)', border: '1px solid var(--border-primary)', borderRadius: '12px' }}
                              />
                              <Bar dataKey="count" fill="#e5a440" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </>
                    )}
                  </>
                )}
          </div>
        )}
    </>
  );

  // Panel 모드 — PanelShell 로 통합
  if (isPanel) {
    return (
      <PanelShell
        title={t('fullTitle')}
        subtitle={t('subtitleHeader')}
        icon={PieChart}
        iconColor={PANEL_COLOR}
        onClose={onClose}
        bodyClassName="p-0 flex flex-col overflow-hidden"
        actions={<HelpToggle active={showHelp} onToggle={() => setShowHelp(!showHelp)} color={PANEL_COLOR} />}
      >
        {body}
      </PanelShell>
    );
  }

  // 모달 모드 — 기존 카드 구조
  return (
    <div className="fixed inset-0 flex items-end sm:items-center justify-center z-[1100] p-0 sm:p-4 bg-black/50 backdrop-blur-sm">
      <div className="glass-panel w-full max-w-5xl h-[95vh] sm:h-auto sm:max-h-[90vh] flex flex-col rounded-t-2xl sm:rounded-2xl">
        {modalHeader}
        {body}
      </div>
    </div>
  );
}
