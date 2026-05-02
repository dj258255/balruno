'use client';

/**
 * Home Layout Store — Stage 2+3.
 *
 * Interface 개념 (Airtable 식):
 *   - 여러 "Interface" = 각자 다른 위젯 조합을 저장된 레이아웃
 *   - 유저가 탭으로 전환
 *   - 기본 3개 제공: 통합 / 디자이너 뷰 / PM 뷰
 *
 * localStorage 기반 persist (Stage 3 BE 오면 서버 저장으로 upgrade).
 * Zustand 대신 단순 훅 + localStorage 사용 — 다른 store 와 섞일 일 없음.
 */

import { useEffect, useState, useCallback } from 'react';
import type { WidgetId } from '@/components/home/widgetRegistry';
import { sanitizeWidgetIds, ALL_WIDGET_IDS } from '@/components/home/widgetRegistry';

export interface HomeInterface {
  id: string;
  name: string;
  widgetIds: WidgetId[];
}

interface HomeLayoutState {
  interfaces: HomeInterface[];
  activeInterfaceId: string;
}

const STORAGE_KEY = 'balruno:home-layout-v1';

const DEFAULT_STATE: HomeLayoutState = {
  activeInterfaceId: 'integrated',
  interfaces: [
    {
      id: 'integrated',
      name: '통합',
      widgetIds: ['hero', 'recent-edits', 'quick-start', 'recent-changes'],
    },
    {
      id: 'designer',
      name: '디자이너',
      widgetIds: ['balance-health', 'recent-edits', 'recent-changes', 'quick-start'],
    },
    {
      id: 'pm',
      name: 'PM',
      widgetIds: ['hero', 'burndown', 'my-sprint', 'my-bugs', 'playtest', 'recent-changes'],
    },
  ],
};

function loadState(): HomeLayoutState {
  if (typeof window === 'undefined') return DEFAULT_STATE;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw) as HomeLayoutState;
    // sanitize — 제거된 widget id 걸러내기
    return {
      activeInterfaceId: parsed.activeInterfaceId,
      interfaces: parsed.interfaces.map((iface) => ({
        ...iface,
        widgetIds: sanitizeWidgetIds(iface.widgetIds),
      })),
    };
  } catch {
    return DEFAULT_STATE;
  }
}

function saveState(state: HomeLayoutState): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // 쿼터 초과 등 무시
  }
}

/**
 * Home Layout 훅 — 상태 + 조작 메서드 반환.
 * 모든 mutation 은 즉시 localStorage 반영.
 */
export function useHomeLayout() {
  const [state, setState] = useState<HomeLayoutState>(DEFAULT_STATE);
  const [hydrated, setHydrated] = useState(false);

  // SSR hydration safe — 마운트 후 localStorage 로드
  useEffect(() => {
    setState(loadState());
    setHydrated(true);
  }, []);

  const update = useCallback((next: HomeLayoutState) => {
    setState(next);
    saveState(next);
  }, []);

  const activeInterface = state.interfaces.find((i) => i.id === state.activeInterfaceId)
    ?? state.interfaces[0];

  const setActive = useCallback((id: string) => {
    if (state.interfaces.some((i) => i.id === id)) {
      update({ ...state, activeInterfaceId: id });
    }
  }, [state, update]);

  const addWidget = useCallback((widgetId: WidgetId) => {
    const iface = state.interfaces.find((i) => i.id === state.activeInterfaceId);
    if (!iface || iface.widgetIds.includes(widgetId)) return;
    update({
      ...state,
      interfaces: state.interfaces.map((i) =>
        i.id === state.activeInterfaceId
          ? { ...i, widgetIds: [...i.widgetIds, widgetId] }
          : i
      ),
    });
  }, [state, update]);

  const removeWidget = useCallback((widgetId: WidgetId) => {
    update({
      ...state,
      interfaces: state.interfaces.map((i) =>
        i.id === state.activeInterfaceId
          ? { ...i, widgetIds: i.widgetIds.filter((w) => w !== widgetId) }
          : i
      ),
    });
  }, [state, update]);

  const moveWidget = useCallback((widgetId: WidgetId, direction: 'up' | 'down') => {
    const iface = state.interfaces.find((i) => i.id === state.activeInterfaceId);
    if (!iface) return;
    const idx = iface.widgetIds.indexOf(widgetId);
    if (idx < 0) return;
    const newIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= iface.widgetIds.length) return;
    const newIds = [...iface.widgetIds];
    [newIds[idx], newIds[newIdx]] = [newIds[newIdx], newIds[idx]];
    update({
      ...state,
      interfaces: state.interfaces.map((i) =>
        i.id === state.activeInterfaceId ? { ...i, widgetIds: newIds } : i
      ),
    });
  }, [state, update]);

  const createInterface = useCallback((name: string) => {
    const id = `iface_${Date.now()}`;
    const newIface: HomeInterface = {
      id,
      name: name.trim() || '새 Interface',
      widgetIds: ['hero', 'recent-edits', 'quick-start'],
    };
    update({
      interfaces: [...state.interfaces, newIface],
      activeInterfaceId: id,
    });
    return id;
  }, [state, update]);

  const deleteInterface = useCallback((id: string) => {
    if (state.interfaces.length <= 1) return; // 마지막 하나는 못 지움
    const remaining = state.interfaces.filter((i) => i.id !== id);
    update({
      interfaces: remaining,
      activeInterfaceId: state.activeInterfaceId === id
        ? remaining[0].id
        : state.activeInterfaceId,
    });
  }, [state, update]);

  const renameInterface = useCallback((id: string, name: string) => {
    update({
      ...state,
      interfaces: state.interfaces.map((i) =>
        i.id === id ? { ...i, name: name.trim() || i.name } : i
      ),
    });
  }, [state, update]);

  const resetToDefault = useCallback(() => {
    update(DEFAULT_STATE);
  }, [update]);

  return {
    hydrated,
    interfaces: state.interfaces,
    activeInterface,
    availableWidgets: ALL_WIDGET_IDS.filter((id) => !activeInterface.widgetIds.includes(id)),
    setActive,
    addWidget,
    removeWidget,
    moveWidget,
    createInterface,
    deleteInterface,
    renameInterface,
    resetToDefault,
  };
}
