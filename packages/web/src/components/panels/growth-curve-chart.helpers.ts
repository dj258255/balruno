import { SCALE } from '@/lib/formulaEngine';
import type { CurveType } from '@/types';

export interface GrowthSegment {
  id: string;
  startLevel: number;
  endLevel: number;
  curveType: CurveType;
  rate: number;
}

export type InterpolationType = 'none' | 'linear' | 'smooth';
export type ViewMode = 'curve' | 'growthRate' | 'xpRequired' | 'timeProgress';

export const PANEL_COLOR = '#3db88a';

export const CURVE_COLORS: Record<string, string> = {
  linear: '#5a9cf5',
  exponential: '#e86161',
  logarithmic: '#3db88a',
  quadratic: '#e5a440',
  custom: '#9179f2',
  segmented: '#e87aa8',
  diminishing: '#ff7f50',
};

export const SCENARIO_COLORS = [
  '#5a9cf5',
  '#e86161',
  '#3db88a',
  '#e5a440',
  '#9179f2',
  '#e87aa8',
];

export const CURVE_KEYS = [
  'linear',
  'exponential',
  'logarithmic',
  'quadratic',
] as const;

export function hermiteInterpolate(t: number): number {
  return t * t * (3 - 2 * t);
}

/** Diminishing Returns (수확 체감) — softCap 초과분에 감쇠 적용 */
export function calculateDiminishing(
  base: number,
  level: number,
  rate: number,
  softCap: number,
  hardCap: number
): number {
  const rawValue = base + level * rate;
  if (rawValue <= softCap) return rawValue;

  const overCap = rawValue - softCap;
  const diminishedGain = overCap * (1 - overCap / (overCap + softCap * 0.5));
  const result = softCap + diminishedGain;

  return hardCap > 0 ? Math.min(result, hardCap) : result;
}

/** 레벨업에 필요한 경험치 계산 */
export function calculateXPRequired(
  baseXP: number,
  level: number,
  exponent: number,
  curveType: 'polynomial' | 'exponential' | 'runescape'
): number {
  switch (curveType) {
    case 'polynomial':
      return Math.floor(baseXP * Math.pow(level, exponent));
    case 'exponential':
      return Math.floor(baseXP * Math.pow(exponent, level - 1));
    case 'runescape': {
      let total = 0;
      for (let l = 1; l < level; l++) {
        total += Math.floor(l + 300 * Math.pow(2, l / 7));
      }
      return Math.floor(total / 4);
    }
    default:
      return baseXP * level;
  }
}

export function calculateSegmentedValue(
  baseValue: number,
  level: number,
  segments: GrowthSegment[],
  interpolation: InterpolationType = 'none',
  transitionWidth: number = 3
): number {
  if (segments.length === 0) return baseValue;

  const sortedSegments = [...segments].sort((a, b) => a.startLevel - b.startLevel);

  const segmentValues: { start: number; end: number }[] = [];
  let runningValue = baseValue;

  for (const segment of sortedSegments) {
    const startValue = runningValue;
    const levelsInSegment = segment.endLevel - segment.startLevel + 1;

    for (let l = 1; l <= levelsInSegment; l++) {
      runningValue = SCALE(startValue, l + 1, segment.rate, segment.curveType);
    }

    segmentValues.push({ start: startValue, end: runningValue });
  }

  if (interpolation === 'none') {
    let currentValue = baseValue;
    let prevEndLevel = 0;

    for (let i = 0; i < sortedSegments.length; i++) {
      const segment = sortedSegments[i];
      if (level < segment.startLevel) break;

      const segmentStart = Math.max(segment.startLevel, prevEndLevel + 1);
      const segmentEnd = Math.min(segment.endLevel, level);

      if (segmentStart <= segmentEnd) {
        const levelsInSegment = segmentEnd - segmentStart + 1;
        const startValue = currentValue;

        for (let l = 1; l <= levelsInSegment; l++) {
          currentValue = SCALE(startValue, l + 1, segment.rate, segment.curveType);
        }
      }

      prevEndLevel = segment.endLevel;
    }

    return currentValue;
  }

  let currentValue = baseValue;
  let prevEndLevel = 0;

  for (let i = 0; i < sortedSegments.length; i++) {
    const segment = sortedSegments[i];
    if (level < segment.startLevel) break;

    const segmentStart = Math.max(segment.startLevel, prevEndLevel + 1);
    const segmentEnd = Math.min(segment.endLevel, level);

    if (segmentStart <= segmentEnd) {
      const levelsInSegment = segmentEnd - segmentStart + 1;
      const startValue = currentValue;

      for (let l = 1; l <= levelsInSegment; l++) {
        currentValue = SCALE(startValue, l + 1, segment.rate, segment.curveType);
      }

      if (
        i < sortedSegments.length - 1 &&
        level >= segment.endLevel - transitionWidth &&
        level <= segment.endLevel
      ) {
        const nextSegment = sortedSegments[i + 1];
        const nextSegmentLevels =
          Math.min(level, nextSegment.endLevel) - nextSegment.startLevel + 1;

        if (nextSegmentLevels > 0) {
          let nextValue = segmentValues[i].end;
          const nextStartValue = segmentValues[i].end;
          const levelsToCalc = Math.min(
            transitionWidth,
            nextSegment.endLevel - nextSegment.startLevel + 1
          );

          for (let l = 1; l <= levelsToCalc; l++) {
            nextValue = SCALE(nextStartValue, l + 1, nextSegment.rate, nextSegment.curveType);
          }

          const transitionStart = segment.endLevel - transitionWidth;
          const t = Math.max(0, Math.min(1, (level - transitionStart) / (transitionWidth * 2)));
          const blendFactor = interpolation === 'smooth' ? hermiteInterpolate(t) : t;
          const targetValue =
            segmentValues[i].end + (nextValue - segmentValues[i].end) * (t / 2);
          currentValue = currentValue + (targetValue - currentValue) * blendFactor;
        }
      }
    }

    prevEndLevel = segment.endLevel;
  }

  return currentValue;
}
