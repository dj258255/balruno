'use client';

/**
 * GrowthCurveChart 의 scenarios / segments 관리 로직을 훅으로 분리.
 * 1,662줄 god component 분해 (Track D-2 2차).
 */

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import type { CurveType } from '@/types';
import type { GrowthSegment } from '../growth-curve-chart.helpers';

export interface Scenario {
  id: string;
  name: string;
  color: string;
  base: number;
  rate: number;
  curveType: CurveType;
  enabled: boolean;
}

const SCENARIO_COLORS = ['#5a9cf5', '#e86161', '#3db88a', '#e5a440', '#9179f2', '#e87aa8'];

export function useScenarios(initial: Scenario[]) {
  const t = useTranslations('growthCurve');
  const [scenarios, setScenarios] = useState<Scenario[]>(initial);

  const add = useCallback(() => {
    const templates = [
      { name: t('templateHp'), base: 500, rate: 1.06 },
      { name: t('templateAtk'), base: 50, rate: 1.08 },
      { name: t('templateDef'), base: 30, rate: 1.05 },
      { name: t('templateSpeed'), base: 100, rate: 1.03 },
    ];
    setScenarios((prev) => {
      const template = templates[prev.length % templates.length];
      return [
        ...prev,
        {
          id: Date.now().toString(),
          name: `${template.name} ${Math.floor(prev.length / templates.length) + 1}`,
          color: SCENARIO_COLORS[prev.length % SCENARIO_COLORS.length],
          base: template.base,
          rate: template.rate,
          curveType: 'linear',
          enabled: true,
        },
      ];
    });
  }, [t]);

  const remove = useCallback((id: string) => {
    setScenarios((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const update = useCallback((id: string, updates: Partial<Scenario>) => {
    setScenarios((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)));
  }, []);

  return { scenarios, setScenarios, addScenario: add, removeScenario: remove, updateScenario: update };
}

export function useSegments(initial: GrowthSegment[], maxLevel: number) {
  const [segments, setSegments] = useState<GrowthSegment[]>(initial);

  const add = useCallback(() => {
    setSegments((prev) => {
      const last = prev[prev.length - 1];
      const newStart = last ? last.endLevel + 1 : 1;
      const newEnd = Math.min(newStart + 10, maxLevel);
      if (newStart > maxLevel) return prev;
      return [
        ...prev,
        {
          id: Date.now().toString(),
          startLevel: newStart,
          endLevel: newEnd,
          curveType: 'linear',
          rate: 10,
        },
      ];
    });
  }, [maxLevel]);

  const remove = useCallback((id: string) => {
    setSegments((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const update = useCallback((id: string, updates: Partial<GrowthSegment>) => {
    setSegments((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)));
  }, []);

  return { segments, setSegments, addSegment: add, removeSegment: remove, updateSegment: update };
}
