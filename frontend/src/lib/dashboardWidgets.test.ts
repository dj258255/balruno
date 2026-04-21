/**
 * 게임 메트릭 위젯 계산 테스트.
 */

import { describe, it, expect } from 'vitest';
import {
  computeRetentionCurve,
  computeFunnel,
  computeWhaleCurve,
  computeLiveopsKpi,
  type RetentionCurveWidget,
  type FunnelWidget,
  type WhaleCurveWidget,
  type LiveopsKpiWidget,
} from './dashboardWidgets';

describe('dashboardWidgets — game metrics', () => {
  it('computeRetentionCurve: 단조 감소', () => {
    const w: RetentionCurveWidget = {
      id: 'w1', type: 'retention-curve', title: 'R',
      config: { day1: 0.4, p: 0.6, days: 30 },
    };
    const curve = computeRetentionCurve(w);
    expect(curve.length).toBe(30);
    expect(curve[0].retention).toBeCloseTo(0.4);
    // 단조 감소
    for (let i = 1; i < curve.length; i++) {
      expect(curve[i].retention).toBeLessThanOrEqual(curve[i - 1].retention);
    }
  });

  it('computeFunnel: 누적 감소', () => {
    const w: FunnelWidget = {
      id: 'w2', type: 'funnel', title: 'F',
      config: {
        steps: [
          { label: 'A', rate: 1 },
          { label: 'B', rate: 0.5 },
          { label: 'C', rate: 0.4 },
        ],
      },
    };
    const rows = computeFunnel(w);
    expect(rows[0].cumulative).toBeCloseTo(1);
    expect(rows[1].cumulative).toBeCloseTo(0.5);
    expect(rows[2].cumulative).toBeCloseTo(0.2);
  });

  it('computeWhaleCurve: 80/20 검증', () => {
    const w: WhaleCurveWidget = {
      id: 'w3', type: 'whale-curve', title: 'W',
      config: { topPercent: 0.2, shareOfRevenue: 0.8 },
    };
    const rows = computeWhaleCurve(w, 20);
    // 끝점 0 과 100 커버
    expect(rows[0].cumShare).toBeCloseTo(0, 0);
    expect(rows[rows.length - 1].cumShare).toBeCloseTo(100, 0);
    // 상위 20% (percentile=0.2) 에서 ~80% 점유
    const at20 = rows.find((r) => Math.abs(r.percentile - 20) < 6);
    expect(at20!.cumShare).toBeGreaterThan(70);
  });

  it('computeLiveopsKpi', () => {
    const w: LiveopsKpiWidget = {
      id: 'w4', type: 'liveops-kpi', title: 'K',
      config: {
        dau: 10000, mau: 50000, revenue: 2000,
        payingUsers: 300, newUsers: 500, adSpend: 800,
      },
    };
    const k = computeLiveopsKpi(w);
    expect(k.stickiness).toBeCloseTo(0.2);
    expect(k.arpdau).toBeCloseTo(0.2);
    expect(k.arppu).toBeCloseTo(6.67, 1);
    expect(k.cac).toBeCloseTo(1.6);
    expect(k.roas).toBeCloseTo(2.5);
  });
});
