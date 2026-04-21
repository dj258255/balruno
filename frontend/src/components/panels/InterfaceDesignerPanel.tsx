'use client';

/**
 * Track 9 — Interface Designer 패널.
 *
 * react-grid-layout 으로 위젯을 자유 배치/리사이즈하는 대시보드.
 * 위젯 타입 5개 (metric / chart-line / text / sheet-table / distribution).
 * 레이아웃은 localStorage 에 프로젝트별 저장.
 *
 * MVP 범위: 빠른 추가/삭제/리사이즈/편집. 협업 동기화는 추후 (Y.Doc 통합).
 */

import { useEffect, useMemo, useState } from 'react';
import GridLayout from 'react-grid-layout';
import { LayoutGrid, Plus, Settings, Trash2 } from 'lucide-react';
import { useProjectStore } from '@/stores/projectStore';
import type { Sheet, Project } from '@/types';
import {
  loadDashboard,
  saveDashboard,
  generateWidgetId,
  computeMetric,
  computeChartLine,
  computeDistribution,
  computeCategoryValues,
  computeScatter,
  computeRetentionCurve,
  computeFunnel,
  computeWhaleCurve,
  computeLiveopsKpi,
  type DashboardLayout,
  type DashboardWidget,
  type WidgetType,
} from '@/lib/dashboardWidgets';
import { toast } from '@/components/ui/Toast';
import { loadAutomations, runAutomation } from '@/lib/automations';
import { useProjectStore as useStoreForButton } from '@/stores/projectStore';
import PanelShell from '@/components/ui/PanelShell';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

interface Props {
  onClose: () => void;
}

const WIDGET_LABELS: Record<WidgetType, string> = {
  metric: '메트릭',
  'chart-line': '라인',
  'chart-bar': '바',
  'chart-pie': '파이',
  'chart-scatter': '스캐터',
  text: '텍스트',
  'sheet-table': '시트',
  distribution: '분포',
  button: '버튼',
  image: '이미지',
  'filter-control': '필터',
  'retention-curve': '잔존 곡선',
  funnel: '퍼널',
  'whale-curve': '고래 곡선',
  'liveops-kpi': 'LiveOps KPI',
};

export default function InterfaceDesignerPanel({ onClose }: Props) {
  const { projects, currentProjectId } = useProjectStore();
  const project = projects.find((p) => p.id === currentProjectId);

  const [layout, setLayout] = useState<DashboardLayout>({ widgets: [], positions: [] });
  const [editingWidget, setEditingWidget] = useState<string | null>(null);
  const [width, setWidth] = useState(800);

  // 프로젝트 변경 시 로드
  useEffect(() => {
    if (currentProjectId) {
      setLayout(loadDashboard(currentProjectId));
    }
  }, [currentProjectId]);

  // 변경 시 자동 저장 (디바운스 없이 — localStorage 빠름)
  useEffect(() => {
    if (currentProjectId) saveDashboard(currentProjectId, layout);
  }, [currentProjectId, layout]);

  // 컨테이너 너비 측정
  useEffect(() => {
    const update = () => {
      const el = document.getElementById('dashboard-container');
      if (el) setWidth(el.clientWidth);
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const addWidget = (type: WidgetType) => {
    if (!project || project.sheets.length === 0) return;
    const sheet = project.sheets[0];
    const id = generateWidgetId();
    let widget: DashboardWidget;
    switch (type) {
      case 'metric':
        widget = {
          id, type: 'metric', title: '새 메트릭',
          config: { sheetId: sheet.id, column: sheet.columns[0]?.name ?? '', aggregate: 'avg' },
        };
        break;
      case 'chart-line':
        widget = {
          id, type: 'chart-line', title: '새 차트',
          config: {
            sheetId: sheet.id,
            xColumn: sheet.columns[0]?.name ?? '',
            yColumn: sheet.columns[1]?.name ?? sheet.columns[0]?.name ?? '',
            color: '#3b82f6',
          },
        };
        break;
      case 'text':
        widget = { id, type: 'text', title: '메모', config: { body: '내용을 입력하세요...' } };
        break;
      case 'sheet-table':
        widget = {
          id, type: 'sheet-table', title: sheet.name,
          config: { sheetId: sheet.id, rowLimit: 5 },
        };
        break;
      case 'distribution':
        widget = {
          id, type: 'distribution', title: '분포',
          config: { sheetId: sheet.id, column: sheet.columns[0]?.name ?? '', bins: 10 },
        };
        break;
      case 'chart-bar':
        widget = {
          id, type: 'chart-bar', title: '바 차트',
          config: {
            sheetId: sheet.id,
            categoryColumn: sheet.columns[0]?.name ?? '',
            valueColumn: sheet.columns[1]?.name ?? sheet.columns[0]?.name ?? '',
            color: '#10b981',
            limit: 10,
          },
        };
        break;
      case 'chart-pie':
        widget = {
          id, type: 'chart-pie', title: '파이 차트',
          config: {
            sheetId: sheet.id,
            categoryColumn: sheet.columns[0]?.name ?? '',
            valueColumn: sheet.columns[1]?.name ?? sheet.columns[0]?.name ?? '',
          },
        };
        break;
      case 'chart-scatter':
        widget = {
          id, type: 'chart-scatter', title: '스캐터',
          config: {
            sheetId: sheet.id,
            xColumn: sheet.columns[0]?.name ?? '',
            yColumn: sheet.columns[1]?.name ?? sheet.columns[0]?.name ?? '',
            color: '#8b5cf6',
          },
        };
        break;
      case 'button':
        widget = {
          id, type: 'button', title: '액션 버튼',
          config: { label: '실행', color: '#3b82f6' },
        };
        break;
      case 'image':
        widget = {
          id, type: 'image', title: '이미지',
          config: { staticUrl: '', fit: 'cover' },
        };
        break;
      case 'filter-control':
        widget = {
          id, type: 'filter-control', title: '필터',
          config: { filterKey: 'filter1', options: ['A', 'B', 'C'] },
        };
        break;
      case 'retention-curve':
        widget = {
          id, type: 'retention-curve', title: '코호트 잔존율',
          config: { day1: 0.4, p: 0.6, days: 30, color: '#3b82f6' },
        };
        break;
      case 'funnel':
        widget = {
          id, type: 'funnel', title: '전환 퍼널',
          config: {
            steps: [
              { label: 'Install', rate: 1 },
              { label: 'Tutorial', rate: 0.8 },
              { label: 'D1', rate: 0.4 },
              { label: 'First Pay', rate: 0.05 },
            ],
            color: '#f59e0b',
          },
        };
        break;
      case 'whale-curve':
        widget = {
          id, type: 'whale-curve', title: '고래 곡선 (파레토)',
          config: { topPercent: 0.1, shareOfRevenue: 0.5, color: '#8b5cf6' },
        };
        break;
      case 'liveops-kpi':
        widget = {
          id, type: 'liveops-kpi', title: 'LiveOps KPI 대시보드',
          config: {
            dau: 10000, mau: 50000, revenue: 2000,
            payingUsers: 300, newUsers: 500, adSpend: 800,
          },
        };
        break;
    }
    const positions = [
      ...layout.positions,
      { i: id, x: (layout.widgets.length * 4) % 12, y: Infinity, w: 4, h: 3 },
    ];
    setLayout({ widgets: [...layout.widgets, widget], positions });
  };

  const removeWidget = (id: string) => {
    setLayout({
      widgets: layout.widgets.filter((w) => w.id !== id),
      positions: layout.positions.filter((p) => p.i !== id),
    });
    if (editingWidget === id) setEditingWidget(null);
  };

  const updateWidget = (id: string, patch: Partial<DashboardWidget>) => {
    setLayout((prev) => ({
      ...prev,
      widgets: prev.widgets.map((w) => (w.id === id ? ({ ...w, ...patch } as DashboardWidget) : w)),
    }));
  };

  return (
    <PanelShell
      title="Interface Designer"
      subtitle="대시보드 위젯 배치"
      icon={LayoutGrid}
      onClose={onClose}
      bodyClassName="flex flex-col p-0 overflow-hidden"
    >
      <div className="flex items-center gap-1 p-2 border-b overflow-x-auto flex-shrink-0" style={{ borderColor: 'var(--border-primary)' }}>
        <span className="text-[10px] mr-2 flex-shrink-0" style={{ color: 'var(--text-secondary)' }}>위젯 추가:</span>
        {(Object.keys(WIDGET_LABELS) as WidgetType[]).map((type) => (
          <button
            key={type}
            onClick={() => addWidget(type)}
            className="text-[11px] flex items-center gap-1 px-2 py-1 rounded flex-shrink-0"
            style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}
          >
            <Plus size={10} />
            {WIDGET_LABELS[type]}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto" id="dashboard-container">
        {layout.widgets.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <LayoutGrid size={32} style={{ color: 'var(--text-secondary)' }} />
            <p className="text-sm mt-2" style={{ color: 'var(--text-primary)' }}>대시보드가 비어있습니다</p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>위 툴바에서 위젯을 추가하세요</p>
          </div>
        ) : (
          <GridLayout
            className="layout"
            layout={layout.positions}
            gridConfig={{ cols: 12, rowHeight: 48 }}
            width={width}
            onLayoutChange={(newLayout) =>
              setLayout((prev) => ({
                ...prev,
                positions: newLayout.map((l) => ({ i: l.i, x: l.x, y: l.y, w: l.w, h: l.h })),
              }))
            }
            dragConfig={{ handle: '.widget-drag-handle' }}
          >
            {layout.widgets.map((w) => (
              <div key={w.id} className="rounded border overflow-hidden" style={{ borderColor: 'var(--border-primary)', background: 'var(--bg-secondary)' }}>
                <div className="widget-drag-handle flex items-center justify-between p-1.5 border-b cursor-move" style={{ borderColor: 'var(--border-primary)', background: 'var(--bg-tertiary)' }}>
                  <span className="text-[11px] font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{w.title}</span>
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    <button
                      onClick={() => setEditingWidget(editingWidget === w.id ? null : w.id)}
                      className="p-0.5 rounded hover:bg-[var(--bg-primary)]"
                    >
                      <Settings size={10} style={{ color: 'var(--text-secondary)' }} />
                    </button>
                    <button onClick={() => removeWidget(w.id)} className="p-0.5 rounded hover:bg-[var(--bg-primary)]">
                      <Trash2 size={10} style={{ color: 'var(--text-secondary)' }} />
                    </button>
                  </div>
                </div>
                <div className="p-2 h-[calc(100%-28px)] overflow-auto">
                  {editingWidget === w.id ? (
                    <WidgetEditor widget={w} project={project} onUpdate={(patch) => updateWidget(w.id, patch)} />
                  ) : (
                    <WidgetRender widget={w} sheets={project?.sheets ?? []} />
                  )}
                </div>
              </div>
            ))}
          </GridLayout>
        )}
      </div>
    </PanelShell>
  );
}

function WidgetRender({ widget, sheets }: { widget: DashboardWidget; sheets: Sheet[] }) {
  if (widget.type === 'metric') {
    const { value, valid } = computeMetric(widget, sheets);
    const display = typeof value === 'number'
      ? Math.abs(value) >= 1000 ? value.toLocaleString(undefined, { maximumFractionDigits: 1 }) : value.toFixed(2)
      : String(value);
    return (
      <div className="flex flex-col h-full justify-center">
        <div className="text-2xl font-bold" style={{ color: valid ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
          {display}{widget.config.suffix ?? ''}
        </div>
        <div className="text-[10px] mt-1" style={{ color: 'var(--text-secondary)' }}>
          {widget.config.aggregate} · {widget.config.column}
        </div>
      </div>
    );
  }

  if (widget.type === 'text') {
    return (
      <div className="text-xs whitespace-pre-wrap" style={{ color: 'var(--text-primary)' }}>
        {widget.config.body}
      </div>
    );
  }

  if (widget.type === 'sheet-table') {
    const sheet = sheets.find((s) => s.id === widget.config.sheetId);
    if (!sheet) return <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>시트 없음</div>;
    const cols = widget.config.columnIds && widget.config.columnIds.length > 0
      ? sheet.columns.filter((c) => widget.config.columnIds!.includes(c.id))
      : sheet.columns.slice(0, 4);
    const rows = sheet.rows.slice(0, widget.config.rowLimit);
    return (
      <table className="w-full text-[10px]">
        <thead>
          <tr>{cols.map((c) => <th key={c.id} className="text-left p-0.5 font-semibold" style={{ color: 'var(--text-primary)' }}>{c.name}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              {cols.map((c) => (
                <td key={c.id} className="p-0.5 truncate" style={{ color: 'var(--text-secondary)' }}>
                  {String(r.cells[c.id] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  if (widget.type === 'chart-line') {
    const points = computeChartLine(widget, sheets);
    if (points.length === 0) return <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>데이터 없음</div>;
    const xMin = Math.min(...points.map((p) => p.x));
    const xMax = Math.max(...points.map((p) => p.x));
    const yMin = Math.min(...points.map((p) => p.y));
    const yMax = Math.max(...points.map((p) => p.y));
    const W = 200, H = 80;
    const sx = (x: number) => 4 + ((x - xMin) / (xMax - xMin || 1)) * (W - 8);
    const sy = (y: number) => H - 4 - ((y - yMin) / (yMax - yMin || 1)) * (H - 8);
    return (
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        <polyline
          fill="none"
          stroke={widget.config.color ?? '#3b82f6'}
          strokeWidth="1.5"
          points={points.map((p) => `${sx(p.x)},${sy(p.y)}`).join(' ')}
        />
      </svg>
    );
  }

  if (widget.type === 'chart-bar') {
    const data = computeCategoryValues(sheets, widget.config.sheetId, widget.config.categoryColumn, widget.config.valueColumn);
    const top = data.slice(0, widget.config.limit ?? 10);
    if (top.length === 0) return <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>데이터 없음</div>;
    const maxVal = Math.max(...top.map((d) => d.value));
    return (
      <div className="flex items-end gap-1 h-full">
        {top.map((d) => (
          <div key={d.category} className="flex-1 flex flex-col items-center justify-end gap-0.5 min-w-0">
            <div
              className="w-full rounded-t"
              style={{
                height: `${Math.max(4, (d.value / maxVal) * 100)}%`,
                background: widget.config.color ?? '#10b981',
                opacity: 0.85,
              }}
              title={`${d.category}: ${d.value.toFixed(1)}`}
            />
            <div className="text-[8px] truncate w-full text-center" style={{ color: 'var(--text-secondary)' }}>
              {d.category}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (widget.type === 'chart-pie') {
    const data = computeCategoryValues(sheets, widget.config.sheetId, widget.config.categoryColumn, widget.config.valueColumn);
    if (data.length === 0) return <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>데이터 없음</div>;
    const total = data.reduce((s, d) => s + d.value, 0);
    const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#06b6d4'];
    let angle = 0;
    const W = 100;
    const R = 40;
    const cx = 50, cy = 50;
    return (
      <div className="flex items-center gap-2 h-full">
        <svg viewBox={`0 0 ${W} ${W}`} className="flex-shrink-0" style={{ width: 80, height: 80 }}>
          {data.map((d, i) => {
            const frac = d.value / total;
            const a0 = angle * Math.PI * 2;
            const a1 = (angle + frac) * Math.PI * 2;
            angle += frac;
            const x0 = cx + R * Math.cos(a0 - Math.PI / 2);
            const y0 = cy + R * Math.sin(a0 - Math.PI / 2);
            const x1 = cx + R * Math.cos(a1 - Math.PI / 2);
            const y1 = cy + R * Math.sin(a1 - Math.PI / 2);
            const largeArc = frac > 0.5 ? 1 : 0;
            return (
              <path
                key={i}
                d={`M ${cx} ${cy} L ${x0} ${y0} A ${R} ${R} 0 ${largeArc} 1 ${x1} ${y1} Z`}
                fill={COLORS[i % COLORS.length]}
              />
            );
          })}
        </svg>
        <div className="flex-1 min-w-0 space-y-0.5 overflow-y-auto text-[10px]">
          {data.slice(0, 8).map((d, i) => (
            <div key={d.category} className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
              <span className="flex-1 truncate" style={{ color: 'var(--text-primary)' }}>{d.category}</span>
              <span className="font-mono flex-shrink-0" style={{ color: 'var(--text-secondary)' }}>
                {((d.value / total) * 100).toFixed(0)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (widget.type === 'chart-scatter') {
    const points = computeScatter(widget, sheets);
    if (points.length === 0) return <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>데이터 없음</div>;
    const xMin = Math.min(...points.map((p) => p.x));
    const xMax = Math.max(...points.map((p) => p.x));
    const yMin = Math.min(...points.map((p) => p.y));
    const yMax = Math.max(...points.map((p) => p.y));
    const W = 200, H = 80;
    const sx = (x: number) => 4 + ((x - xMin) / (xMax - xMin || 1)) * (W - 8);
    const sy = (y: number) => H - 4 - ((y - yMin) / (yMax - yMin || 1)) * (H - 8);
    return (
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        {points.map((p, i) => (
          <circle key={i} cx={sx(p.x)} cy={sy(p.y)} r={2} fill={widget.config.color ?? '#8b5cf6'} opacity={0.7} />
        ))}
      </svg>
    );
  }

  if (widget.type === 'button') {
    return <ButtonWidgetRender widget={widget} />;
  }

  if (widget.type === 'image') {
    const src = widget.config.staticUrl
      || (widget.config.sheetId && widget.config.urlColumn && sheets.find((s) => s.id === widget.config.sheetId)?.rows?.[widget.config.rowIndex ?? 0]?.cells?.[sheets.find((s) => s.id === widget.config.sheetId)?.columns.find((c) => c.name === widget.config.urlColumn)?.id ?? ''] as string);
    if (!src) return <div className="text-xs text-center py-4" style={{ color: 'var(--text-secondary)' }}>URL 을 설정하세요</div>;
    return (
      <div
        className="w-full h-full"
        style={{
          backgroundImage: `url("${String(src).replace(/"/g, '\\"')}")`,
          backgroundSize: widget.config.fit === 'contain' ? 'contain' : 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      />
    );
  }

  if (widget.type === 'filter-control') {
    return <FilterControlRender widget={widget} />;
  }

  if (widget.type === 'distribution') {
    const { bins, min, max } = computeDistribution(widget, sheets);
    if (bins.length === 0) return <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>데이터 없음</div>;
    const maxBin = Math.max(...bins);
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-end gap-0.5 flex-1">
          {bins.map((b, i) => (
            <div
              key={i}
              className="flex-1"
              style={{
                height: `${(b / maxBin) * 100}%`,
                background: 'var(--accent)',
                opacity: 0.8,
              }}
              title={`${b}`}
            />
          ))}
        </div>
        <div className="flex justify-between text-[9px] mt-1" style={{ color: 'var(--text-secondary)' }}>
          <span>{min.toFixed(1)}</span>
          <span>{max.toFixed(1)}</span>
        </div>
      </div>
    );
  }

  if (widget.type === 'retention-curve') {
    const pts = computeRetentionCurve(widget);
    const W = 200, H = 90;
    const yMax = 1;
    const sx = (i: number) => (i / (pts.length - 1)) * (W - 8) + 4;
    const sy = (y: number) => H - 4 - (y / yMax) * (H - 10);
    const polyline = pts.map((p, i) => `${sx(i)},${sy(p.retention)}`).join(' ');
    return (
      <div className="flex flex-col h-full">
        <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
          <polyline fill="none" stroke={widget.config.color ?? '#3b82f6'} strokeWidth="1.5" points={polyline} />
        </svg>
        <div className="flex justify-between text-[9px]" style={{ color: 'var(--text-secondary)' }}>
          <span>D1: {(widget.config.day1 * 100).toFixed(0)}%</span>
          <span>D{widget.config.days}: {(pts[pts.length - 1].retention * 100).toFixed(1)}%</span>
        </div>
      </div>
    );
  }

  if (widget.type === 'funnel') {
    const steps = computeFunnel(widget);
    if (steps.length === 0) return <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>데이터 없음</div>;
    return (
      <div className="flex flex-col gap-1 h-full justify-center">
        {steps.map((s, i) => (
          <div key={i} className="flex items-center gap-2 text-[10px]">
            <div className="w-12 truncate flex-shrink-0" style={{ color: 'var(--text-primary)' }}>{s.label}</div>
            <div className="flex-1 h-2.5 rounded overflow-hidden" style={{ background: 'var(--bg-tertiary)' }}>
              <div
                className="h-full"
                style={{
                  width: `${s.cumulative * 100}%`,
                  background: widget.config.color ?? '#f59e0b',
                  opacity: 0.85,
                }}
              />
            </div>
            <div className="w-10 text-right font-mono" style={{ color: 'var(--text-secondary)' }}>
              {(s.cumulative * 100).toFixed(1)}%
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (widget.type === 'whale-curve') {
    const pts = computeWhaleCurve(widget);
    const W = 200, H = 90;
    const sx = (p: number) => (p / 100) * (W - 8) + 4;
    const sy = (s: number) => H - 4 - (s / 100) * (H - 10);
    const polyline = pts.map((p) => `${sx(p.percentile)},${sy(p.cumShare)}`).join(' ');
    return (
      <div className="flex flex-col h-full">
        <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
          <line x1={4} y1={H - 4} x2={W - 4} y2={4} stroke="var(--border-primary)" strokeDasharray="2,2" strokeWidth={1} />
          <polyline fill="none" stroke={widget.config.color ?? '#8b5cf6'} strokeWidth="1.5" points={polyline} />
        </svg>
        <div className="text-[9px] text-center" style={{ color: 'var(--text-secondary)' }}>
          상위 {(widget.config.topPercent * 100).toFixed(0)}% 가 {(widget.config.shareOfRevenue * 100).toFixed(0)}% 매출
        </div>
      </div>
    );
  }

  if (widget.type === 'liveops-kpi') {
    const k = computeLiveopsKpi(widget);
    const row = (label: string, value: string) => (
      <div className="flex items-center justify-between text-[10px]">
        <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
        <span className="font-mono font-semibold" style={{ color: 'var(--text-primary)' }}>{value}</span>
      </div>
    );
    return (
      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
        {row('DAU', k.dau.toLocaleString())}
        {row('MAU', k.mau.toLocaleString())}
        {row('Stickiness', `${(k.stickiness * 100).toFixed(1)}%`)}
        {row('ARPDAU', `$${k.arpdau.toFixed(3)}`)}
        {row('ARPPU', `$${k.arppu.toFixed(2)}`)}
        {row('CAC', `$${k.cac.toFixed(2)}`)}
        {row('ROAS', `${k.roas.toFixed(2)}x`)}
        {row('Payback', isFinite(k.payback) ? `${k.payback.toFixed(1)}d` : '∞')}
      </div>
    );
  }

  return null;
}

function WidgetEditor({
  widget, project, onUpdate,
}: {
  widget: DashboardWidget;
  project: Project | null | undefined;
  onUpdate: (patch: Partial<DashboardWidget>) => void;
}) {
  if (!project) return <div className="text-xs">프로젝트 없음</div>;

  const sheets = project.sheets;
  const config = widget.config as Record<string, unknown>;
  const currentSheet = sheets.find((s) => s.id === (config.sheetId as string));

  return (
    <div className="space-y-1.5 text-[11px]">
      <input
        value={widget.title}
        onChange={(e) => onUpdate({ title: e.target.value })}
        placeholder="제목"
        className="w-full px-1.5 py-0.5 rounded border bg-transparent"
        style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
      />
      {widget.type !== 'text' && (
        <select
          value={config.sheetId as string}
          onChange={(e) => onUpdate({ config: { ...config, sheetId: e.target.value } } as Partial<DashboardWidget>)}
          className="w-full px-1.5 py-0.5 rounded border bg-transparent"
          style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
        >
          {sheets.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      )}
      {widget.type === 'metric' && (
        <>
          <select
            value={config.column as string}
            onChange={(e) => onUpdate({ config: { ...config, column: e.target.value } } as Partial<DashboardWidget>)}
            className="w-full px-1.5 py-0.5 rounded border bg-transparent"
            style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
          >
            {currentSheet?.columns.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
          <select
            value={config.aggregate as string}
            onChange={(e) => onUpdate({ config: { ...config, aggregate: e.target.value } } as Partial<DashboardWidget>)}
            className="w-full px-1.5 py-0.5 rounded border bg-transparent"
            style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
          >
            <option value="sum">합계</option>
            <option value="avg">평균</option>
            <option value="min">최소</option>
            <option value="max">최대</option>
            <option value="count">개수</option>
            <option value="cell">단일 셀</option>
          </select>
          <input
            value={(config.suffix as string) ?? ''}
            onChange={(e) => onUpdate({ config: { ...config, suffix: e.target.value } } as Partial<DashboardWidget>)}
            placeholder="단위 (예: G, %)"
            className="w-full px-1.5 py-0.5 rounded border bg-transparent"
            style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
          />
        </>
      )}
      {widget.type === 'chart-line' && (
        <>
          <select
            value={config.xColumn as string}
            onChange={(e) => onUpdate({ config: { ...config, xColumn: e.target.value } } as Partial<DashboardWidget>)}
            className="w-full px-1.5 py-0.5 rounded border bg-transparent"
            style={{ borderColor: 'var(--border-primary)' }}
          >
            <option value="">X 컬럼</option>
            {currentSheet?.columns.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
          <select
            value={config.yColumn as string}
            onChange={(e) => onUpdate({ config: { ...config, yColumn: e.target.value } } as Partial<DashboardWidget>)}
            className="w-full px-1.5 py-0.5 rounded border bg-transparent"
            style={{ borderColor: 'var(--border-primary)' }}
          >
            <option value="">Y 컬럼</option>
            {currentSheet?.columns.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
          <input
            type="color"
            value={(config.color as string) ?? '#3b82f6'}
            onChange={(e) => onUpdate({ config: { ...config, color: e.target.value } } as Partial<DashboardWidget>)}
            className="w-full h-6 rounded border-0"
          />
        </>
      )}
      {widget.type === 'distribution' && (
        <>
          <select
            value={config.column as string}
            onChange={(e) => onUpdate({ config: { ...config, column: e.target.value } } as Partial<DashboardWidget>)}
            className="w-full px-1.5 py-0.5 rounded border bg-transparent"
            style={{ borderColor: 'var(--border-primary)' }}
          >
            {currentSheet?.columns.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
          <input
            type="number"
            value={(config.bins as number) ?? 10}
            onChange={(e) => onUpdate({ config: { ...config, bins: parseInt(e.target.value) || 10 } } as Partial<DashboardWidget>)}
            placeholder="bin 개수"
            className="w-full px-1.5 py-0.5 rounded border bg-transparent"
            style={{ borderColor: 'var(--border-primary)' }}
          />
        </>
      )}
      {widget.type === 'sheet-table' && (
        <input
          type="number"
          value={config.rowLimit as number}
          onChange={(e) => onUpdate({ config: { ...config, rowLimit: parseInt(e.target.value) || 5 } } as Partial<DashboardWidget>)}
          placeholder="행 개수"
          className="w-full px-1.5 py-0.5 rounded border bg-transparent"
          style={{ borderColor: 'var(--border-primary)' }}
        />
      )}
      {widget.type === 'text' && (
        <textarea
          value={config.body as string}
          onChange={(e) => onUpdate({ config: { ...config, body: e.target.value } } as Partial<DashboardWidget>)}
          rows={4}
          className="w-full px-1.5 py-0.5 rounded border bg-transparent resize-none"
          style={{ borderColor: 'var(--border-primary)' }}
        />
      )}
    </div>
  );
}

function ButtonWidgetRender({ widget }: { widget: import('@/lib/dashboardWidgets').ButtonWidget }) {
  const projects = useStoreForButton((s) => s.projects);
  const currentProjectId = useStoreForButton((s) => s.currentProjectId);
  const updateCell = useStoreForButton((s) => s.updateCell);

  const handleClick = async () => {
    const project = projects.find((p) => p.id === currentProjectId);
    if (!widget.config.automationId || !project) {
      toast.info(`${widget.config.label} 클릭됨 (자동화 미연결)`);
      return;
    }
    const autos = loadAutomations(project.id);
    const target = autos.find((a) => a.id === widget.config.automationId);
    if (!target) {
      toast.error('연결된 자동화를 찾을 수 없음');
      return;
    }
    await runAutomation(target, project, {
      onNotify: (msg) => toast.info(msg),
      onUpdateCell: (sheetId, rowId, columnId, value) => {
        updateCell(project.id, sheetId, rowId, columnId, value as never);
      },
    });
  };

  return (
    <button
      onClick={handleClick}
      className="w-full h-full rounded font-semibold text-xs transition-opacity hover:opacity-85"
      style={{
        background: widget.config.color ?? 'var(--accent)',
        color: 'white',
      }}
    >
      {widget.config.label || '버튼'}
    </button>
  );
}

function FilterControlRender({ widget }: { widget: import('@/lib/dashboardWidgets').FilterControlWidget }) {
  const [value, setValue] = useState(widget.config.defaultValue ?? widget.config.options[0] ?? '');
  return (
    <div className="space-y-1 h-full flex flex-col justify-center">
      <label className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>
        {widget.config.filterKey}
      </label>
      <select
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="w-full px-2 py-1 text-xs rounded border bg-transparent"
        style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
      >
        {widget.config.options.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    </div>
  );
}
