'use client';

/**
 * 민감도 분석 패널 — Tornado + Spider 차트로 수식 인풋의 영향도를 시각화.
 *
 * 사용 흐름:
 *  1. 시트 선택 → 공식(output) 컬럼 선택
 *  2. 기준 행 선택 (baseline)
 *  3. 흔들 입력 컬럼 체크 (수치형만)
 *  4. 변동 범위 슬라이더 (±5~50%)
 */

import { useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { Activity, BarChart3 as BarIcon, Minus, Plus } from 'lucide-react';
import { useProjectStore } from '@/stores/projectStore';
import SheetSelector from './SheetSelector';
import { computeSheetRows } from '@/lib/formulaEngine';
import { tornadoAnalysis, spiderAnalysis } from '@/lib/sensitivityAnalysis';
import { useEscapeKey } from '@/hooks';
import Select from '@/components/ui/Select';
import Checkbox from '@/components/ui/Checkbox';
import { evaluate } from 'mathjs';
import type { CellValue } from '@/types';

interface Props {
  onClose: () => void;
  isPanel?: boolean;
}

type Mode = 'tornado' | 'spider';

function toNumber(v: CellValue | undefined): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export default function SensitivityAnalysisPanel({ onClose, isPanel }: Props) {
  useEscapeKey(onClose);

  const projects = useProjectStore((s) => s.projects);
  const currentProjectId = useProjectStore((s) => s.currentProjectId);
  const currentSheetId = useProjectStore((s) => s.currentSheetId);

  const [projectId, setProjectId] = useState(currentProjectId ?? '');
  const [sheetId, setSheetId] = useState(currentSheetId ?? '');
  const [outputColId, setOutputColId] = useState<string>('');
  const [baselineRowIdx, setBaselineRowIdx] = useState<number>(0);
  const [selectedInputs, setSelectedInputs] = useState<Set<string>>(new Set());
  const [variation, setVariation] = useState<number>(0.2);
  const [mode, setMode] = useState<Mode>('tornado');

  const project = useMemo(() => projects.find((p) => p.id === projectId), [projects, projectId]);
  const sheet = useMemo(() => project?.sheets.find((s) => s.id === sheetId), [project, sheetId]);

  const formulaColumns = useMemo(
    () => sheet?.columns.filter((c) => c.type === 'formula') ?? [],
    [sheet]
  );

  const numericColumns = useMemo(
    () =>
      sheet?.columns.filter((c) =>
        c.type === 'general' || c.type === 'currency' || c.type === 'rating'
      ) ?? [],
    [sheet]
  );

  const computedRows = useMemo(() => {
    if (!project || !sheet) return [] as Record<string, CellValue>[];
    return computeSheetRows(sheet, project.sheets);
  }, [project, sheet]);

  const baselineRow = computedRows[baselineRowIdx] ?? computedRows[0];

  const baselineInputs = useMemo(() => {
    if (!baselineRow || !sheet) return [] as { name: string; value: number; colId: string }[];
    return Array.from(selectedInputs)
      .map((colId) => {
        const col = sheet.columns.find((c) => c.id === colId);
        if (!col) return null;
        const num = toNumber(baselineRow[colId]);
        if (num === null) return null;
        return { name: col.name, value: num, colId };
      })
      .filter((x): x is { name: string; value: number; colId: string } => Boolean(x));
  }, [baselineRow, selectedInputs, sheet]);

  // 수식에서 컬럼명/id 를 inputs key 로 매핑해 mathjs 평가.
  const outputFn = useMemo(() => {
    const outCol = sheet?.columns.find((c) => c.id === outputColId);
    if (!outCol || !outCol.formula) return null;
    const raw = outCol.formula.trim();
    const expr = raw.startsWith('=') ? raw.slice(1) : raw;
    const nameToColId = new Map<string, string>();
    sheet?.columns.forEach((c) => nameToColId.set(c.name, c.id));
    return (inputs: Record<string, number>) => {
      try {
        // inputs 는 { columnName: number } 로 들어옴. mathjs 에 그대로 전달.
        // 수식이 col id (c1/c2...) 를 참조하면, 기준 행값을 채워 넣음
        const scope: Record<string, number> = { ...inputs };
        if (baselineRow) {
          sheet?.columns.forEach((c) => {
            if (!(c.id in scope)) {
              const num = toNumber(baselineRow[c.id]);
              if (num !== null) scope[c.id] = num;
            }
            // name 도 채워서 두 방식 모두 작동하게
            if (!(c.name in scope)) {
              const num = toNumber(baselineRow[c.id]);
              if (num !== null) scope[c.name] = num;
            }
          });
          // selectedInputs 의 colId 키도 name 키와 동기화
          Array.from(selectedInputs).forEach((colId) => {
            const col = sheet?.columns.find((c) => c.id === colId);
            if (col && col.name in scope) scope[col.id] = scope[col.name];
          });
        }
        return evaluate(expr, scope) as number;
      } catch {
        return 0;
      }
    };
  }, [sheet, outputColId, baselineRow, selectedInputs]);

  const tornadoBars = useMemo(() => {
    if (!outputFn || baselineInputs.length === 0) return [];
    return tornadoAnalysis(baselineInputs, outputFn, variation);
  }, [outputFn, baselineInputs, variation]);

  const spiderSeries = useMemo(() => {
    if (!outputFn || baselineInputs.length === 0) return [];
    return spiderAnalysis(baselineInputs, outputFn, 11, 0.5);
  }, [outputFn, baselineInputs]);

  const spiderChartData = useMemo(() => {
    if (spiderSeries.length === 0) return [];
    const steps = spiderSeries[0].points.length;
    const rows: Record<string, number>[] = [];
    for (let i = 0; i < steps; i++) {
      const percent = spiderSeries[0].points[i].percent;
      const row: Record<string, number> = { percent };
      spiderSeries.forEach((s) => {
        row[s.variable] = s.points[i].value;
      });
      rows.push(row);
    }
    return rows;
  }, [spiderSeries]);

  const toggleInput = (colId: string) => {
    setSelectedInputs((prev) => {
      const next = new Set(prev);
      if (next.has(colId)) next.delete(colId);
      else next.add(colId);
      return next;
    });
  };

  const barColors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];

  return (
    <div className={isPanel ? 'h-full flex flex-col' : 'h-full'} style={{ background: 'var(--bg-primary)' }}>
      <div
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: 'var(--border-primary)' }}
      >
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4" style={{ color: 'var(--primary-purple)' }} />
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            민감도 분석 — Tornado / Spider
          </h2>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => setMode('tornado')}
            className="px-2.5 py-1 text-xs rounded"
            style={{
              background: mode === 'tornado' ? 'var(--primary-purple-light)' : 'var(--bg-tertiary)',
              color: mode === 'tornado' ? 'var(--primary-purple)' : 'var(--text-secondary)',
            }}
          >
            <BarIcon className="w-3 h-3 inline mr-1" /> Tornado
          </button>
          <button
            onClick={() => setMode('spider')}
            className="px-2.5 py-1 text-xs rounded"
            style={{
              background: mode === 'spider' ? 'var(--primary-purple-light)' : 'var(--bg-tertiary)',
              color: mode === 'spider' ? 'var(--primary-purple)' : 'var(--text-secondary)',
            }}
          >
            <Activity className="w-3 h-3 inline mr-1" /> Spider
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <SheetSelector
          showProjectSelector
          selectedProjectId={projectId}
          selectedSheetId={sheetId}
          onProjectChange={(pid) => {
            setProjectId(pid);
            setSheetId('');
            setOutputColId('');
            setBaselineRowIdx(0);
            setSelectedInputs(new Set());
          }}
          onSheetChange={(sid) => {
            setSheetId(sid);
            setOutputColId('');
            setBaselineRowIdx(0);
            setSelectedInputs(new Set());
          }}
        />

        {sheet && formulaColumns.length > 0 && (
          <div>
            <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-secondary)' }}>
              출력 (공식 컬럼)
            </label>
            <Select
              value={outputColId}
              onChange={setOutputColId}
              options={[
                { value: '', label: '— 선택하세요 —' },
                ...formulaColumns.map((c) => ({
                  value: c.id,
                  label: c.name,
                  description: c.formula,
                })),
              ]}
            />
          </div>
        )}

        {sheet && computedRows.length > 0 && (
          <div>
            <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-secondary)' }}>
              기준 행 (baseline)
            </label>
            <Select
              value={String(baselineRowIdx)}
              onChange={(v) => setBaselineRowIdx(Number(v))}
              options={computedRows.slice(0, 50).map((r, i) => {
                const firstText = sheet.columns
                  .map((c) => r[c.id])
                  .find((v) => typeof v === 'string') as string | undefined;
                return { value: String(i), label: `Row ${i + 1}${firstText ? ` — ${firstText}` : ''}` };
              })}
            />
          </div>
        )}

        {sheet && numericColumns.length > 0 && (
          <div>
            <label className="text-xs font-medium block mb-2" style={{ color: 'var(--text-secondary)' }}>
              흔들 입력 변수 ({selectedInputs.size}개 선택)
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {numericColumns.map((col) => (
                <label key={col.id} className="flex items-center gap-2 text-xs cursor-pointer">
                  <Checkbox
                    checked={selectedInputs.has(col.id)}
                    onChange={() => toggleInput(col.id)}
                  />
                  <span style={{ color: 'var(--text-primary)' }}>{col.name}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <div>
          <div className="text-xs font-medium mb-1 flex items-center justify-between" style={{ color: 'var(--text-secondary)' }}>
            <span>변동 범위</span>
            <span className="font-mono">±{(variation * 100).toFixed(0)}%</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setVariation((v) => Math.max(0.05, v - 0.05))}
              className="p-1 rounded"
              style={{ background: 'var(--bg-tertiary)' }}
            >
              <Minus className="w-3 h-3" />
            </button>
            <input
              type="range"
              min={0.05}
              max={0.5}
              step={0.05}
              value={variation}
              onChange={(e) => setVariation(Number(e.target.value))}
              className="flex-1"
            />
            <button
              onClick={() => setVariation((v) => Math.min(0.5, v + 0.05))}
              className="p-1 rounded"
              style={{ background: 'var(--bg-tertiary)' }}
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
        </div>

        {tornadoBars.length === 0 && (
          <div className="text-xs text-center py-8" style={{ color: 'var(--text-tertiary)' }}>
            시트 → 출력 공식 컬럼 → 기준 행 → 흔들 입력 변수를 선택하세요.
          </div>
        )}

        {mode === 'tornado' && tornadoBars.length > 0 && (
          <div>
            <div className="text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>
              기준값: <b style={{ color: 'var(--text-primary)' }}>{tornadoBars[0].baseline.toFixed(2)}</b>
              {'  —  큰 영향일수록 위쪽'}
            </div>
            <ResponsiveContainer width="100%" height={Math.max(180, tornadoBars.length * 38)}>
              <BarChart
                layout="vertical"
                data={tornadoBars.map((b) => ({
                  variable: b.variable,
                  '−variation': b.low - b.baseline,
                  '+variation': b.high - b.baseline,
                }))}
                margin={{ left: 60, right: 20, top: 10, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" />
                <XAxis type="number" stroke="var(--text-tertiary)" fontSize={11} />
                <YAxis
                  type="category"
                  dataKey="variable"
                  stroke="var(--text-tertiary)"
                  fontSize={11}
                  width={60}
                />
                <Tooltip
                  formatter={(v: number) => (v >= 0 ? `+${v.toFixed(2)}` : v.toFixed(2))}
                  contentStyle={{
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-primary)',
                    fontSize: 11,
                  }}
                />
                <ReferenceLine x={0} stroke="var(--text-primary)" />
                <Bar dataKey="−variation" fill="#ef4444" stackId="a" />
                <Bar dataKey="+variation" fill="#10b981" stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {mode === 'spider' && spiderChartData.length > 0 && (
          <div>
            <div className="text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>
              변수별 -50% ~ +50% 스윕. 기울기 큰 선이 민감한 변수.
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={spiderChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" />
                <XAxis
                  dataKey="percent"
                  stroke="var(--text-tertiary)"
                  fontSize={11}
                  tickFormatter={(v) => `${v > 0 ? '+' : ''}${v.toFixed(0)}%`}
                />
                <YAxis stroke="var(--text-tertiary)" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-primary)',
                    fontSize: 11,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <ReferenceLine x={0} stroke="var(--text-primary)" strokeDasharray="2 2" />
                {spiderSeries.map((s, i) => (
                  <Line
                    key={s.variable}
                    type="monotone"
                    dataKey={s.variable}
                    stroke={barColors[i % barColors.length]}
                    strokeWidth={2}
                    dot={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {tornadoBars.length > 0 && mode === 'tornado' && (
          <div className="text-caption p-2 rounded" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
            <b>해석</b>: 상위 변수 ±{(variation * 100).toFixed(0)}% 변화가 출력에 가장 큰 영향. 하위는 robust.
            밸런싱 시 상위 변수를 먼저 튜닝하는 게 효율적입니다.
          </div>
        )}
      </div>
    </div>
  );
}
