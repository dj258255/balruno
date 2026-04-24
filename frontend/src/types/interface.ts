/**
 * Interface Designer (Dashboard Builder) 타입 정의.
 *
 * Scaffold only — 실제 위젯 렌더러 / react-grid-layout 통합 / 드래그앤드롭 편집기는 다음 세션.
 */

export type WidgetType =
  | 'chart-bar'
  | 'chart-line'
  | 'chart-pie'
  | 'chart-scatter'
  | 'metric-tile'
  | 'table-embed'
  | 'kanban-embed'
  | 'text-block'
  | 'image'
  | 'button'
  | 'filter-control';

export interface WidgetLayout {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Widget {
  id: string;
  type: WidgetType;
  layout: WidgetLayout;
  /** 위젯 타입별 설정 (차트 데이터 소스, 필터 등). 구체 스키마는 타입별 narrow. */
  config: Record<string, unknown>;
  title?: string;
}

export interface Interface {
  id: string;
  name: string;
  description?: string;
  widgets: Widget[];
  /** 전역 필터 상태 — 위젯에 전파 */
  filters?: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
  /** view-only 공유 링크 토큰 */
  shareToken?: string;
}
