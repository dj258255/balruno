'use client';

/**
 * Power Curve Compare 패널 — 여러 시트의 (X, Y) 곡선을 한 화면에 오버레이.
 *
 * 활용 예:
 *   - 직업별 레벨 → 파워 비교 (Warrior vs Mage vs Rogue)
 *   - 무기 티어별 레벨 → DPS 비교
 *   - 난이도별 레벨 → 적 HP 비교
 *
 * 시트마다 X 컬럼과 Y 컬럼을 골라 매핑 → SVG 다중 선 차트.
 * 차이 강조: max-min gap 영역 음영 + 시트별 색상 + 호버 툴팁.
 */

import { useMemo, useState } from 'react';
import { Layers, Plus, Trash2 } from 'lucide-react';
import { useProjectStore } from '@/stores/projectStore';
import { computeSheetRows } from '@/lib/formulaEngine';
import PanelShell from '@/components/ui/PanelShell';

interface Props {
  onClose: () => void;
}

const SERIES_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#ec4899', '#14b8a6', '#06b6d4',
];

interface Series {
  id: string;
  sheetId: string;
  xColumn: string;
  yColumn: string;
  label: string;
  color: string;
}

export default function PowerCurveComparePanel({ onClose }: Props) {
  const { projects, currentProjectId } = useProjectStore();
  const project = projects.find((p) => p.id === currentProjectId);

  const [series, setSeries] = useState<Series[]>([]);
  const [hoverX, setHoverX] = useState<number | null>(null);

  const allSheets = project?.sheets ?? [];

  const addSeries = () => {
    if (allSheets.length === 0) return;
    const sheet = allSheets[0];
    const numericCols = sheet.columns.filter((c) => c.type === 'general' || c.type === 'formula');
    const xCol = numericCols[0]?.name ?? '';
    const yCol = numericCols[1]?.name ?? numericCols[0]?.name ?? '';
    const idx = series.length;
    setSeries((prev) => [
      ...prev,
      {
        id: `s${Date.now()}_${idx}`,
        sheetId: sheet.id,
        xColumn: xCol,
        yColumn: yCol,
        label: `${sheet.name}`,
        color: SERIES_COLORS[idx % SERIES_COLORS.length],
      },
    ]);
  };

  const updateSeries = (id: string, patch: Partial<Series>) => {
    setSeries((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  const removeSeries = (id: string) => {
    setSeries((prev) => prev.filter((s) => s.id !== id));
  };

  // 데이터 계산
  const computedSeries = useMemo(() => {
    if (!project) return [];
    return series.map((s) => {
      const sheet = project.sheets.find((sh) => sh.id === s.sheetId);
      if (!sheet) return { ...s, points: [] as { x: number; y: number }[] };
      const computed = computeSheetRows(sheet, project.sheets);
      const points = computed
        .map((row) => {
          const x = Number(row[s.xColumn]);
          const y = Number(row[s.yColumn]);
          if (isNaN(x) || isNaN(y) || !isFinite(x) || !isFinite(y)) return null;
          return { x, y };
        })
        .filter((p): p is { x: number; y: number } => p !== null)
        .sort((a, b) => a.x - b.x);
      return { ...s, points };
    });
  }, [series, project]);

  // X/Y 범위
  const { xMin, xMax, yMin, yMax } = useMemo(() => {
    let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;
    for (const s of computedSeries) {
      for (const p of s.points) {
        if (p.x < xMin) xMin = p.x;
        if (p.x > xMax) xMax = p.x;
        if (p.y < yMin) yMin = p.y;
        if (p.y > yMax) yMax = p.y;
      }
    }
    if (!isFinite(xMin)) return { xMin: 0, xMax: 1, yMin: 0, yMax: 1 };
    if (xMax === xMin) xMax = xMin + 1;
    if (yMax === yMin) yMax = yMin + 1;
    return { xMin, xMax, yMin: Math.min(0, yMin), yMax };
  }, [computedSeries]);

  // SVG 좌표 매핑
  const W = 480;
  const H = 280;
  const PAD = { top: 16, right: 16, bottom: 28, left: 44 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const sx = (x: number) => PAD.left + ((x - xMin) / (xMax - xMin)) * innerW;
  const sy = (y: number) => PAD.top + (1 - (y - yMin) / (yMax - yMin)) * innerH;

  // gap envelope (모든 시리즈에서 동일 X 가 있는 구간만)
  const gapEnvelope = useMemo(() => {
    if (computedSeries.length < 2) return null;
    // 공통 X 좌표 (정수 값으로 매칭)
    const commonX: number[] = [];
    const allXs = computedSeries.map((s) => new Set(s.points.map((p) => p.x)));
    if (allXs.length === 0) return null;
    for (const x of allXs[0]) {
      if (allXs.every((set) => set.has(x))) commonX.push(x);
    }
    commonX.sort((a, b) => a - b);
    return commonX.map((x) => {
      const ys = computedSeries.map((s) => s.points.find((p) => p.x === x)?.y ?? NaN).filter((y) => !isNaN(y));
      return { x, min: Math.min(...ys), max: Math.max(...ys) };
    });
  }, [computedSeries]);

  // 호버 라인 → 가까운 X 의 모든 시리즈 값
  const hoverData = useMemo(() => {
    if (hoverX === null) return null;
    return computedSeries.map((s) => {
      // 가까운 점 보간 없이 nearest neighbor
      let nearest = s.points[0];
      let dist = Infinity;
      for (const p of s.points) {
        const d = Math.abs(p.x - hoverX);
        if (d < dist) { dist = d; nearest = p; }
      }
      return { series: s, point: nearest };
    });
  }, [hoverX, computedSeries]);

  return (
    <PanelShell
      title="Power Curve Compare"
      subtitle="여러 시트 곡선 오버레이"
      icon={Layers}
      onClose={onClose}
    >
      <div className="space-y-3">
        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          여러 시트의 (X, Y) 곡선을 한 화면에 겹쳐 비교합니다 — 직업별 파워, 무기 티어별 DPS 등.
        </p>

        {/* Chart */}
        <div className="rounded border p-2" style={{ borderColor: 'var(--border-primary)', background: 'var(--bg-primary)' }}>
          {computedSeries.some((s) => s.points.length > 0) ? (
            <svg
              width="100%"
              viewBox={`0 0 ${W} ${H}`}
              onMouseLeave={() => setHoverX(null)}
              onMouseMove={(e) => {
                const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
                const px = ((e.clientX - rect.left) / rect.width) * W;
                if (px < PAD.left || px > W - PAD.right) {
                  setHoverX(null);
                } else {
                  const x = xMin + ((px - PAD.left) / innerW) * (xMax - xMin);
                  setHoverX(x);
                }
              }}
            >
              {/* axes */}
              <line x1={PAD.left} y1={H - PAD.bottom} x2={W - PAD.right} y2={H - PAD.bottom} stroke="var(--border-primary)" />
              <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={H - PAD.bottom} stroke="var(--border-primary)" />

              {/* y ticks */}
              {[0, 0.25, 0.5, 0.75, 1].map((t) => {
                const yv = yMin + t * (yMax - yMin);
                return (
                  <g key={t}>
                    <line x1={PAD.left - 3} y1={sy(yv)} x2={PAD.left} y2={sy(yv)} stroke="var(--border-primary)" />
                    <text x={PAD.left - 6} y={sy(yv) + 3} textAnchor="end" fontSize="9" fill="var(--text-secondary)">
                      {yv.toFixed(yMax > 100 ? 0 : 1)}
                    </text>
                    <line x1={PAD.left} y1={sy(yv)} x2={W - PAD.right} y2={sy(yv)} stroke="var(--border-primary)" strokeOpacity="0.2" />
                  </g>
                );
              })}

              {/* x ticks */}
              {[0, 0.25, 0.5, 0.75, 1].map((t) => {
                const xv = xMin + t * (xMax - xMin);
                return (
                  <g key={t}>
                    <line x1={sx(xv)} y1={H - PAD.bottom} x2={sx(xv)} y2={H - PAD.bottom + 3} stroke="var(--border-primary)" />
                    <text x={sx(xv)} y={H - PAD.bottom + 13} textAnchor="middle" fontSize="9" fill="var(--text-secondary)">
                      {xv.toFixed(xMax > 100 ? 0 : 1)}
                    </text>
                  </g>
                );
              })}

              {/* gap envelope */}
              {gapEnvelope && gapEnvelope.length > 1 && (
                <path
                  d={`M ${gapEnvelope.map((p) => `${sx(p.x)} ${sy(p.max)}`).join(' L ')} L ${[...gapEnvelope].reverse().map((p) => `${sx(p.x)} ${sy(p.min)}`).join(' L ')} Z`}
                  fill="var(--accent)"
                  fillOpacity="0.06"
                />
              )}

              {/* lines */}
              {computedSeries.map((s) => (
                <g key={s.id}>
                  <polyline
                    fill="none"
                    stroke={s.color}
                    strokeWidth="2"
                    points={s.points.map((p) => `${sx(p.x)},${sy(p.y)}`).join(' ')}
                  />
                  {s.points.length < 50 && s.points.map((p) => (
                    <circle key={`${p.x}-${p.y}`} cx={sx(p.x)} cy={sy(p.y)} r="2" fill={s.color} />
                  ))}
                </g>
              ))}

              {/* hover line */}
              {hoverX !== null && hoverData && (
                <g>
                  <line x1={sx(hoverX)} y1={PAD.top} x2={sx(hoverX)} y2={H - PAD.bottom} stroke="var(--text-secondary)" strokeDasharray="2 2" strokeOpacity="0.5" />
                  {hoverData.map(({ series: s, point }) => (
                    <circle key={s.id} cx={sx(point.x)} cy={sy(point.y)} r="4" fill={s.color} stroke="var(--bg-primary)" strokeWidth="1.5" />
                  ))}
                </g>
              )}
            </svg>
          ) : (
            <div className="text-center text-xs py-12" style={{ color: 'var(--text-secondary)' }}>
              시리즈를 추가하세요.
            </div>
          )}
        </div>

        {/* Hover tooltip */}
        {hoverData && (
          <div className="text-[11px] space-y-0.5">
            {hoverData.map(({ series: s, point }) => (
              <div key={s.id} className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                <span className="flex-1 truncate" style={{ color: 'var(--text-primary)' }}>{s.label}</span>
                <span className="font-mono" style={{ color: 'var(--text-secondary)' }}>
                  {s.xColumn}={point.x} · {s.yColumn}={point.y.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Series editor */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>시리즈</h4>
            <button
              onClick={addSeries}
              disabled={allSheets.length === 0}
              title={allSheets.length === 0 ? '현재 프로젝트에 시트가 없습니다 — 먼저 시트를 만들어주세요' : '새 시리즈 추가'}
              className="text-xs flex items-center gap-1 px-2 py-1 rounded transition-colors hover:bg-[var(--bg-tertiary)] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
              style={{ color: 'var(--accent)' }}
            >
              <Plus size={12} /> 시리즈 추가
            </button>
          </div>

          <div className="space-y-2">
            {series.map((s, idx) => {
              const sheet = allSheets.find((sh) => sh.id === s.sheetId);
              const cols = sheet?.columns.filter((c) => c.type === 'general' || c.type === 'formula') ?? [];
              return (
                <div key={s.id} className="p-2 rounded border space-y-1.5" style={{ borderColor: 'var(--border-primary)', background: 'var(--bg-secondary)' }}>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={s.color}
                      onChange={(e) => updateSeries(s.id, { color: e.target.value })}
                      className="w-6 h-6 rounded border-0 cursor-pointer"
                      style={{ background: 'transparent' }}
                    />
                    <input
                      value={s.label}
                      onChange={(e) => updateSeries(s.id, { label: e.target.value })}
                      className="flex-1 px-2 py-0.5 text-xs rounded border bg-transparent"
                      style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
                    />
                    <button onClick={() => removeSeries(s.id)} className="p-1 rounded hover:bg-[var(--bg-tertiary)]" aria-label="Remove">
                      <Trash2 size={12} style={{ color: 'var(--text-secondary)' }} />
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    <select
                      value={s.sheetId}
                      onChange={(e) => updateSeries(s.id, { sheetId: e.target.value })}
                      className="px-1.5 py-0.5 text-[11px] rounded border bg-transparent"
                      style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
                    >
                      {allSheets.map((sh) => (
                        <option key={sh.id} value={sh.id}>{sh.name}</option>
                      ))}
                    </select>
                    <select
                      value={s.xColumn}
                      onChange={(e) => updateSeries(s.id, { xColumn: e.target.value })}
                      className="px-1.5 py-0.5 text-[11px] rounded border bg-transparent"
                      style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
                    >
                      <option value="">X 컬럼</option>
                      {cols.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
                    </select>
                    <select
                      value={s.yColumn}
                      onChange={(e) => updateSeries(s.id, { yColumn: e.target.value })}
                      className="px-1.5 py-0.5 text-[11px] rounded border bg-transparent"
                      style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
                    >
                      <option value="">Y 컬럼</option>
                      {cols.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="text-[10px] flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
                    <span>#{idx + 1}</span>
                    <span>·</span>
                    <span>{computedSeries.find((cs) => cs.id === s.id)?.points.length ?? 0} 점</span>
                  </div>
                </div>
              );
            })}
            {series.length === 0 && (
              <p className="text-xs text-center py-3" style={{ color: 'var(--text-secondary)' }}>
                {allSheets.length === 0
                  ? '프로젝트에 시트가 없습니다. 왼쪽 사이드바에서 시트를 먼저 만들어주세요.'
                  : '“시리즈 추가” 버튼을 눌러 곡선을 얹어주세요.'}
              </p>
            )}
          </div>
        </section>
      </div>
    </PanelShell>
  );
}
