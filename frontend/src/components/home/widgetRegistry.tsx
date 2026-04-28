/**
 * Home 위젯 레지스트리 — Stage 2+3.
 *
 * 모든 위젯을 ID 로 조회 가능하게. HomeScreen 이 layout store 의 widgetIds 배열을
 * 순회하며 여기서 컴포넌트를 꺼내 렌더.
 *
 * Stage 3 확장: 신규 위젯 추가 시 여기만 등록하면 모든 Interface 에서 사용 가능.
 */

import {
  Sparkles, Clock, History, Zap, Bug, Gamepad2, TrendingUp, Activity, Flame, CalendarDays,
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
import VelocityWidget from './widgets/VelocityWidget';
import CurrentCycleWidget from './widgets/CurrentCycleWidget';
import { useTranslations } from 'next-intl';

export type WidgetId =
  | 'hero'
  | 'recent-edits'
  | 'quick-start'
  | 'recent-changes'
  | 'my-sprint'
  | 'my-bugs'
  | 'playtest'
  | 'balance-health'
  | 'burndown'
  | 'velocity'
  | 'current-cycle';

export type WidgetSize = 'full' | 'half' | 'third';

export interface WidgetMeta {
  id: WidgetId;
  nameKey: string;
  descKey: string;
  icon: LucideIcon;
  color: string;
  size: WidgetSize;
  /** 이 위젯을 렌더 */
  Component: React.FC<{ work: TodaysWork }>;
}

export const WIDGET_REGISTRY: Record<WidgetId, WidgetMeta> = {
  'hero': {
    id: 'hero',
    nameKey: 'widgetRegistry.todayName',
    descKey: 'widgetRegistry.todayDesc',
    icon: Sparkles,
    color: '#8b5cf6',
    size: 'full',
    Component: TodayHeroWidget,
  },
  'recent-edits': {
    id: 'recent-edits',
    nameKey: 'widgetRegistry.recentName',
    descKey: 'widgetRegistry.recentDesc',
    icon: Clock,
    color: '#6366f1',
    size: 'half',
    Component: RecentEditsWidget,
  },
  'quick-start': {
    id: 'quick-start',
    nameKey: 'widgetRegistry.quickStartName',
    descKey: 'widgetRegistry.quickStartDesc',
    icon: Sparkles,
    color: '#8b5cf6',
    size: 'half',
    Component: QuickStartWidget as unknown as React.FC<{ work: TodaysWork }>,
  },
  'recent-changes': {
    id: 'recent-changes',
    nameKey: 'widgetRegistry.recentChangesName',
    descKey: 'widgetRegistry.recentChangesDesc',
    icon: History,
    color: '#10b981',
    size: 'full',
    Component: RecentChangesWidget,
  },
  'my-sprint': {
    id: 'my-sprint',
    nameKey: 'widgetRegistry.mySprintName',
    descKey: 'widgetRegistry.mySprintDesc',
    icon: Zap,
    color: '#3b82f6',
    size: 'half',
    Component: MySprintWidget,
  },
  'my-bugs': {
    id: 'my-bugs',
    nameKey: 'widgetRegistry.myBugsName',
    descKey: 'widgetRegistry.myBugsDesc',
    icon: Bug,
    color: '#ef4444',
    size: 'half',
    Component: MyBugsWidget,
  },
  'playtest': {
    id: 'playtest',
    nameKey: 'widgetRegistry.playtestName',
    descKey: 'widgetRegistry.playtestDesc',
    icon: Gamepad2,
    color: '#10b981',
    size: 'half',
    Component: PlaytestWidget,
  },
  'balance-health': {
    id: 'balance-health',
    nameKey: 'widgetRegistry.balanceStateName',
    descKey: 'widgetRegistry.balanceStateDesc',
    icon: TrendingUp,
    color: '#f59e0b',
    size: 'half',
    Component: BalanceHealthWidget,
  },
  'burndown': {
    id: 'burndown',
    nameKey: 'widgetRegistry.burndownName',
    descKey: 'widgetRegistry.burndownDesc',
    icon: Flame,
    color: '#ef4444',
    size: 'half',
    Component: BurndownWidget as unknown as React.FC<{ work: TodaysWork }>,
  },
  'velocity': {
    id: 'velocity',
    nameKey: 'widgetRegistry.velocityName',
    descKey: 'widgetRegistry.velocityDesc',
    icon: TrendingUp,
    color: '#10b981',
    size: 'half',
    Component: VelocityWidget as unknown as React.FC<{ work: TodaysWork }>,
  },
  'current-cycle': {
    id: 'current-cycle',
    nameKey: 'widgetRegistry.currentCycleName',
    descKey: 'widgetRegistry.currentCycleDesc',
    icon: CalendarDays,
    color: '#3b82f6',
    size: 'half',
    Component: CurrentCycleWidget as unknown as React.FC<{ work: TodaysWork }>,
  },
};

/** 위젯 ID 배열의 유효성 검증 — 등록되지 않은 id 는 필터 */
export function sanitizeWidgetIds(ids: WidgetId[]): WidgetId[] {
  return ids.filter((id) => WIDGET_REGISTRY[id]);
}

export const ALL_WIDGET_IDS: WidgetId[] = Object.keys(WIDGET_REGISTRY) as WidgetId[];
