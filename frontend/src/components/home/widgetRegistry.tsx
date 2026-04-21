/**
 * Home 위젯 레지스트리 — Stage 2+3.
 *
 * 모든 위젯을 ID 로 조회 가능하게. HomeScreen 이 layout store 의 widgetIds 배열을
 * 순회하며 여기서 컴포넌트를 꺼내 렌더.
 *
 * Stage 3 확장: 신규 위젯 추가 시 여기만 등록하면 모든 Interface 에서 사용 가능.
 */

import {
  Sparkles, Clock, History, Zap, Bug, Gamepad2, TrendingUp, Activity, Flame,
  type LucideIcon,
} from 'lucide-react';
import type { TodaysWork } from '@/hooks/useTodaysWork';
import TodayHeroWidget from './widgets/TodayHeroWidget';
import RecentEditsWidget from './widgets/RecentEditsWidget';
import QuickStartWidget from './widgets/QuickStartWidget';
import RecentChangesWidget from './widgets/RecentChangesWidget';
import MySprintWidget from './widgets/MySprintWidget';
import MyBugsWidget from './widgets/MyBugsWidget';
import PlaytestWidget from './widgets/PlaytestWidget';
import BalanceHealthWidget from './widgets/BalanceHealthWidget';
import BurndownWidget from './widgets/BurndownWidget';

export type WidgetId =
  | 'hero'
  | 'recent-edits'
  | 'quick-start'
  | 'recent-changes'
  | 'my-sprint'
  | 'my-bugs'
  | 'playtest'
  | 'balance-health'
  | 'burndown';

export type WidgetSize = 'full' | 'half' | 'third';

export interface WidgetMeta {
  id: WidgetId;
  name: string;
  description: string;
  icon: LucideIcon;
  color: string;
  size: WidgetSize;
  /** 이 위젯을 렌더 */
  Component: React.FC<{ work: TodaysWork }>;
}

export const WIDGET_REGISTRY: Record<WidgetId, WidgetMeta> = {
  'hero': {
    id: 'hero',
    name: '오늘의 작업',
    description: '내 Sprint · 내 버그 · Playtest 요약 (3열 카드)',
    icon: Sparkles,
    color: '#8b5cf6',
    size: 'full',
    Component: TodayHeroWidget,
  },
  'recent-edits': {
    id: 'recent-edits',
    name: '최근 편집',
    description: '7일 이내 편집된 시트 목록',
    icon: Clock,
    color: '#6366f1',
    size: 'half',
    Component: RecentEditsWidget,
  },
  'quick-start': {
    id: 'quick-start',
    name: '빠른 시작',
    description: 'AI · 템플릿 · Excel 가져오기',
    icon: Sparkles,
    color: '#8b5cf6',
    size: 'half',
    Component: QuickStartWidget as unknown as React.FC<{ work: TodaysWork }>,
  },
  'recent-changes': {
    id: 'recent-changes',
    name: '최근 변경',
    description: '셀 변경 히스토리 10개 (Track 12 changelog)',
    icon: History,
    color: '#10b981',
    size: 'full',
    Component: RecentChangesWidget,
  },
  'my-sprint': {
    id: 'my-sprint',
    name: '내 Sprint',
    description: '현재 유저에게 assigned 된 활성 Sprint 아이템',
    icon: Zap,
    color: '#3b82f6',
    size: 'half',
    Component: MySprintWidget,
  },
  'my-bugs': {
    id: 'my-bugs',
    name: '내 버그',
    description: '내게 assigned 된 오픈 버그',
    icon: Bug,
    color: '#ef4444',
    size: 'half',
    Component: MyBugsWidget,
  },
  'playtest': {
    id: 'playtest',
    name: 'Playtest 세션',
    description: '플레이테스트 세션 목록',
    icon: Gamepad2,
    color: '#10b981',
    size: 'half',
    Component: PlaytestWidget,
  },
  'balance-health': {
    id: 'balance-health',
    name: '밸런스 상태',
    description: '프로젝트별 활성 시트 · 행 수',
    icon: TrendingUp,
    color: '#f59e0b',
    size: 'half',
    Component: BalanceHealthWidget,
  },
  'burndown': {
    id: 'burndown',
    name: '번다운 차트',
    description: '스프린트 ideal vs 실제 진척 (changelog 기반)',
    icon: Flame,
    color: '#ef4444',
    size: 'half',
    Component: BurndownWidget as unknown as React.FC<{ work: TodaysWork }>,
  },
};

/** 위젯 ID 배열의 유효성 검증 — 등록되지 않은 id 는 필터 */
export function sanitizeWidgetIds(ids: WidgetId[]): WidgetId[] {
  return ids.filter((id) => WIDGET_REGISTRY[id]);
}

export const ALL_WIDGET_IDS: WidgetId[] = Object.keys(WIDGET_REGISTRY) as WidgetId[];
