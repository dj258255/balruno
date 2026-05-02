/**
 * Interface Designer 위젯 정의 + 데이터 어댑터.
 *
 * 위젯 종류:
 *   - metric:     단일 숫자 (sheet 의 cell or aggregate)
 *   - chart-line: 시트의 X/Y 컬럼 → 미니 라인 차트
 *   - text:       마크다운 텍스트
 *   - sheet-table: 시트 미니 미리보기 (top N rows)
 *   - distribution: 한 컬럼의 distribution (히스토그램)
 *
 * 모든 데이터는 sheets state 에서 derive — 별도 저장 없음.
 */

import type { Sheet, CellValue } from '@/types';
import { computeSheetRows } from './formulaEngine';
import { loadSnapshots, type SimSnapshot, type SnapshotDomain } from './simSnapshots';

export type WidgetType =
  | 'metric'
  | 'chart-line'
  | 'chart-bar'
  | 'chart-pie'
  | 'chart-scatter'
  | 'text'
  | 'sheet-table'
  | 'distribution'
  | 'button'
  | 'image'
  | 'filter-control'
  | 'retention-curve'      // 게임 메트릭: D1/D7/D30 코호트 잔존
  | 'funnel'               // 게임 메트릭: 다단계 전환율
  | 'whale-curve'          // 게임 메트릭: 파레토 매출 분포
  | 'liveops-kpi'          // 게임 메트릭: DAU/MAU/Stickiness/ARPDAU 프리셋
  | 'sim-metric'           // P10: 저장된 시뮬 스냅샷의 특정 metric 값
  | 'sim-trend';           // P10: 여러 스냅샷의 동일 metric 을 시간순 라인차트

export interface WidgetBase {
  id: string;
  type: WidgetType;
  title: string;
}

export interface MetricWidget extends WidgetBase {
  type: 'metric';
  config: {
    sheetId: string;
    column: string;
    /** sum / avg / min / max / count / cell */
    aggregate: 'sum' | 'avg' | 'min' | 'max' | 'count' | 'cell';
    /** aggregate=cell 일 때 행 인덱스 */
    rowIndex?: number;
    suffix?: string;
  };
}

export interface ChartLineWidget extends WidgetBase {
  type: 'chart-line';
  config: {
    sheetId: string;
    xColumn: string;
    yColumn: string;
    color?: string;
  };
}

export interface TextWidget extends WidgetBase {
  type: 'text';
  config: {
    body: string;
  };
}

export interface SheetTableWidget extends WidgetBase {
  type: 'sheet-table';
  config: {
    sheetId: string;
    rowLimit: number;
    columnIds?: string[];
  };
}

export interface DistributionWidget extends WidgetBase {
  type: 'distribution';
  config: {
    sheetId: string;
    column: string;
    bins?: number;
  };
}

export interface ChartBarWidget extends WidgetBase {
  type: 'chart-bar';
  config: {
    sheetId: string;
    categoryColumn: string;
    valueColumn: string;
    color?: string;
    /** 상위 N개만 (기본 10) */
    limit?: number;
  };
}

export interface ChartPieWidget extends WidgetBase {
  type: 'chart-pie';
  config: {
    sheetId: string;
    categoryColumn: string;
    valueColumn: string;
  };
}

export interface ChartScatterWidget extends WidgetBase {
  type: 'chart-scatter';
  config: {
    sheetId: string;
    xColumn: string;
    yColumn: string;
    color?: string;
  };
}

export interface ButtonWidget extends WidgetBase {
  type: 'button';
  config: {
    label: string;
    /** 클릭 시 실행할 automation id (Track연동) */
    automationId?: string;
    color?: string;
  };
}

export interface ImageWidget extends WidgetBase {
  type: 'image';
  config: {
    /** sheetId + urlColumn + rowIndex 조합 또는 staticUrl */
    sheetId?: string;
    urlColumn?: string;
    rowIndex?: number;
    staticUrl?: string;
    fit?: 'cover' | 'contain';
  };
}

export interface FilterControlWidget extends WidgetBase {
  type: 'filter-control';
  config: {
    /** 필터 이름 (다른 위젯이 구독하는 키) — filterKey */
    filterKey: string;
    /** select 옵션 */
    options: string[];
    defaultValue?: string;
  };
}

export interface RetentionCurveWidget extends WidgetBase {
  type: 'retention-curve';
  config: {
    /** D1 잔존율 (0-1). localStorage / 수동 입력. */
    day1: number;
    /** 감소 지수 (멱함수 p) */
    p: number;
    /** 표시 기간 (일) */
    days: number;
    color?: string;
  };
}

export interface FunnelWidget extends WidgetBase {
  type: 'funnel';
  config: {
    steps: { label: string; rate: number }[];  // rate: 직전 단계 대비 통과율 (0-1)
    color?: string;
  };
}

export interface WhaleCurveWidget extends WidgetBase {
  type: 'whale-curve';
  config: {
    /** 상위 topPercent 유저가 shareOfRevenue 를 차지 (호요버스/파레토 계수 계산용) */
    topPercent: number;    // 기본 0.1
    shareOfRevenue: number; // 기본 0.5
    color?: string;
  };
}

/**
 * P10 — 시뮬 스냅샷의 특정 metric 값을 위젯으로 고정.
 * 예: "balance 매트릭스 의 최신 Balance Score" 를 대시보드에 상시 표시.
 *
 * snapshotId = 'latest' 면 해당 metricKey 를 가진 가장 최근 스냅샷 자동 선택.
 */
export interface SimMetricWidget extends WidgetBase {
  type: 'sim-metric';
  config: {
    /** 'latest' 또는 특정 snapshot id */
    snapshotId: string;
    /** 메트릭 key (snapshot.metrics 객체의 키) */
    metricKey: string;
    /** 스냅샷 도메인 필터 (latest 선택 시 사용) */
    domain?: SnapshotDomain;
    suffix?: string;
    /** 임계값 기준 색상 바꾸기 */
    threshold?: { ok: number; warn: number };
  };
}

/**
 * P10 — 여러 스냅샷의 동일 metric 시간순 추이.
 * 반복 튜닝 (snap → 수정 → 다시 snap) 때 개선/악화 곡선 확인.
 */
export interface SimTrendWidget extends WidgetBase {
  type: 'sim-trend';
  config: {
    metricKey: string;
    domain?: SnapshotDomain;
    /** 최대 몇 개 스냅샷까지 표시 (default 20) */
    limit?: number;
    color?: string;
  };
}

export interface LiveopsKpiWidget extends WidgetBase {
  type: 'liveops-kpi';
  config: {
    dau: number;
    mau: number;
    revenue: number;       // 하루 매출 ($)
    payingUsers: number;
    newUsers: number;
    adSpend: number;
  };
}

export type DashboardWidget =
  | MetricWidget
  | ChartLineWidget
  | ChartBarWidget
  | ChartPieWidget
  | ChartScatterWidget
  | TextWidget
  | SheetTableWidget
  | DistributionWidget
  | ButtonWidget
  | ImageWidget
  | FilterControlWidget
  | RetentionCurveWidget
  | FunnelWidget
  | WhaleCurveWidget
  | LiveopsKpiWidget
  | SimMetricWidget
  | SimTrendWidget;

export interface DashboardLayout {
  widgets: DashboardWidget[];
  /** react-grid-layout 호환 layout */
  positions: Array<{ i: string; x: number; y: number; w: number; h: number }>;
}

import { kvStorage } from './kvStorage';

const STORAGE_KEY_PREFIX = 'balruno:dashboard:';

export function loadDashboard(projectId: string): DashboardLayout {
  try {
    const raw = kvStorage.get(STORAGE_KEY_PREFIX + projectId);
    if (!raw) return { widgets: [], positions: [] };
    return JSON.parse(raw) as DashboardLayout;
  } catch {
    return { widgets: [], positions: [] };
  }
}

export function saveDashboard(projectId: string, layout: DashboardLayout): void {
  kvStorage.set(STORAGE_KEY_PREFIX + projectId, JSON.stringify(layout));
}

/** 시트의 한 컬럼 값들을 숫자 배열로 추출 (formula 컬럼은 computed 사용). (private — 같은 파일 내부 widget 계산만 사용) */
function getColumnNumbers(sheet: Sheet, sheets: Sheet[], columnName: string): number[] {
  const computed = computeSheetRows(sheet, sheets);
  return computed
    .map((row) => Number(row[columnName]))
    .filter((n) => !isNaN(n) && isFinite(n));
}

export function computeMetric(
  widget: MetricWidget,
  sheets: Sheet[],
): { value: number | string; valid: boolean } {
  const sheet = sheets.find((s) => s.id === widget.config.sheetId);
  if (!sheet) return { value: 'N/A', valid: false };

  if (widget.config.aggregate === 'cell') {
    const computed = computeSheetRows(sheet, sheets);
    const row = computed[widget.config.rowIndex ?? 0];
    if (!row) return { value: 'N/A', valid: false };
    const v = row[widget.config.column];
    return { value: v as CellValue ?? 'N/A', valid: v !== undefined };
  }

  const nums = getColumnNumbers(sheet, sheets, widget.config.column);
  if (nums.length === 0) return { value: 'N/A', valid: false };

  switch (widget.config.aggregate) {
    case 'sum': return { value: nums.reduce((a, b) => a + b, 0), valid: true };
    case 'avg': return { value: nums.reduce((a, b) => a + b, 0) / nums.length, valid: true };
    case 'min': return { value: Math.min(...nums), valid: true };
    case 'max': return { value: Math.max(...nums), valid: true };
    case 'count': return { value: nums.length, valid: true };
  }
}

export function computeChartLine(widget: ChartLineWidget, sheets: Sheet[]): { x: number; y: number }[] {
  const sheet = sheets.find((s) => s.id === widget.config.sheetId);
  if (!sheet) return [];
  const computed = computeSheetRows(sheet, sheets);
  return computed
    .map((row) => {
      const x = Number(row[widget.config.xColumn]);
      const y = Number(row[widget.config.yColumn]);
      if (isNaN(x) || isNaN(y) || !isFinite(x) || !isFinite(y)) return null;
      return { x, y };
    })
    .filter((p): p is { x: number; y: number } => p !== null)
    .sort((a, b) => a.x - b.x);
}

/** bar/pie 공통 — category 별 합계. */
export function computeCategoryValues(
  sheets: Sheet[],
  sheetId: string,
  categoryColumn: string,
  valueColumn: string,
): Array<{ category: string; value: number }> {
  const sheet = sheets.find((s) => s.id === sheetId);
  if (!sheet) return [];
  const computed = computeSheetRows(sheet, sheets);
  const map = new Map<string, number>();
  for (const row of computed) {
    const cat = String(row[categoryColumn] ?? '(빈값)');
    const val = Number(row[valueColumn]);
    if (isNaN(val)) continue;
    map.set(cat, (map.get(cat) ?? 0) + val);
  }
  return Array.from(map.entries())
    .map(([category, value]) => ({ category, value }))
    .sort((a, b) => b.value - a.value);
}

export function computeScatter(widget: ChartScatterWidget, sheets: Sheet[]): Array<{ x: number; y: number }> {
  return computeChartLine(widget as unknown as ChartLineWidget, sheets);
}

export function computeDistribution(
  widget: DistributionWidget,
  sheets: Sheet[],
): { bins: number[]; min: number; max: number } {
  const sheet = sheets.find((s) => s.id === widget.config.sheetId);
  if (!sheet) return { bins: [], min: 0, max: 0 };
  const nums = getColumnNumbers(sheet, sheets, widget.config.column);
  if (nums.length === 0) return { bins: [], min: 0, max: 0 };

  const binCount = widget.config.bins ?? 10;
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const range = max - min || 1;
  const binSize = range / binCount;
  const bins = new Array(binCount).fill(0);
  for (const n of nums) {
    const idx = Math.min(binCount - 1, Math.floor((n - min) / binSize));
    bins[idx]++;
  }
  return { bins, min, max };
}

let widgetIdCounter = 0;
export function generateWidgetId(): string {
  widgetIdCounter++;
  return `w_${Date.now()}_${widgetIdCounter}`;
}

// ─────── 게임 메트릭 위젯 계산 ───────

export function computeRetentionCurve(
  widget: RetentionCurveWidget,
): Array<{ day: number; retention: number }> {
  const { day1, p, days } = widget.config;
  const rows: Array<{ day: number; retention: number }> = [];
  for (let d = 1; d <= days; d++) {
    const retention = d <= 1 ? day1 : day1 * Math.pow(d, -p);
    rows.push({ day: d, retention });
  }
  return rows;
}

export function computeFunnel(
  widget: FunnelWidget,
): Array<{ label: string; rate: number; cumulative: number }> {
  let cum = 1;
  return widget.config.steps.map((step) => {
    cum = cum * Math.max(0, Math.min(1, step.rate));
    return { label: step.label, rate: step.rate, cumulative: cum };
  });
}

export function computeWhaleCurve(
  widget: WhaleCurveWidget,
  points: number = 20,
): Array<{ percentile: number; cumShare: number }> {
  const { topPercent, shareOfRevenue } = widget.config;
  // F(x) = x^α, α = log(share)/log(topPercent).
  // 조건 F(topPercent)=shareOfRevenue, F(0)=0, F(1)=1 만족.
  const alpha = Math.log(shareOfRevenue) / Math.log(topPercent);
  const rows: Array<{ percentile: number; cumShare: number }> = [];
  for (let i = 0; i <= points; i++) {
    const percentile = i / points;
    const cumShare = Math.pow(percentile, alpha);
    rows.push({ percentile: percentile * 100, cumShare: cumShare * 100 });
  }
  return rows;
}

export interface LiveopsKpiComputed {
  dau: number;
  mau: number;
  stickiness: number;
  arpu: number;
  arpdau: number;
  arppu: number;
  cac: number;
  roas: number;
  payback: number;
}

// ─────── P10 Sim Snapshot 위젯 ───────

export interface SimMetricComputed {
  value: number | null;
  snapshot: SimSnapshot | null;
  /** threshold 기준 status — UI 색상용 */
  status: 'ok' | 'warn' | 'critical' | 'unknown';
}

export function computeSimMetric(widget: SimMetricWidget, snapshotsOverride?: SimSnapshot[]): SimMetricComputed {
  const snapshots = snapshotsOverride ?? loadSnapshots();
  let target: SimSnapshot | undefined;
  if (widget.config.snapshotId === 'latest') {
    // 해당 도메인 + metricKey 가진 가장 최근
    target = snapshots.find(
      (s) => (!widget.config.domain || s.domain === widget.config.domain)
        && widget.config.metricKey in s.metrics,
    );
  } else {
    target = snapshots.find((s) => s.id === widget.config.snapshotId);
  }
  if (!target) return { value: null, snapshot: null, status: 'unknown' };
  const value = target.metrics[widget.config.metricKey];
  if (value === undefined) return { value: null, snapshot: target, status: 'unknown' };

  let status: SimMetricComputed['status'] = 'unknown';
  if (widget.config.threshold) {
    if (value >= widget.config.threshold.ok) status = 'ok';
    else if (value >= widget.config.threshold.warn) status = 'warn';
    else status = 'critical';
  }

  return { value, snapshot: target, status };
}

export interface SimTrendPoint {
  createdAt: number;
  value: number;
  snapshotId: string;
  snapshotName: string;
}

export function computeSimTrend(widget: SimTrendWidget, snapshotsOverride?: SimSnapshot[]): SimTrendPoint[] {
  const snapshots = snapshotsOverride ?? loadSnapshots();
  const filtered = snapshots.filter((s) =>
    (!widget.config.domain || s.domain === widget.config.domain)
    && widget.config.metricKey in s.metrics,
  );
  // 시간순 (오래된 게 앞)
  const sorted = filtered.sort((a, b) => a.createdAt - b.createdAt);
  const limit = widget.config.limit ?? 20;
  const trimmed = sorted.slice(-limit);
  return trimmed.map((s) => ({
    createdAt: s.createdAt,
    value: s.metrics[widget.config.metricKey],
    snapshotId: s.id,
    snapshotName: s.name,
  }));
}

export function computeLiveopsKpi(widget: LiveopsKpiWidget): LiveopsKpiComputed {
  const { dau, mau, revenue, payingUsers, newUsers, adSpend } = widget.config;
  const safe = (n: number, d: number) => (d > 0 ? n / d : 0);
  const stickiness = Math.min(1, safe(dau, mau));
  const arpu = safe(revenue * 30, mau); // 월간 추정
  const arpdau = safe(revenue, dau);
  const arppu = safe(revenue, payingUsers);
  const cac = safe(adSpend, newUsers);
  const roas = safe(revenue, adSpend);
  const payback = arpdau > 0 ? cac / arpdau : Infinity;
  return { dau, mau, stickiness, arpu, arpdau, arppu, cac, roas, payback };
}
