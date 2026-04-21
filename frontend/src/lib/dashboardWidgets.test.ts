/**
 * 게임 메트릭 위젯 계산 테스트.
 */

import { describe, it, expect } from 'vitest';
import {
  computeRetentionCurve,
  computeFunnel,
  computeWhaleCurve,
  computeLiveopsKpi,
  computeSimMetric,
  computeSimTrend,
  type RetentionCurveWidget,
  type FunnelWidget,
  type WhaleCurveWidget,
  type LiveopsKpiWidget,
  type SimMetricWidget,
  type SimTrendWidget,
} from './dashboardWidgets';
import type { SimSnapshot } from './simSnapshots';

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

  describe('computeSimMetric (P10)', () => {
    const mkSnap = (id: string, domain: SimSnapshot['domain'], createdAt: number, metrics: Record<string, number>): SimSnapshot => ({
      id, name: id, createdAt, domain, config: {}, metrics,
    });

    it('latest 모드: 도메인 + metricKey 매치하는 가장 최근 스냅샷', () => {
      const snaps = [
        mkSnap('old', 'unit', 100, { winRate: 0.4 }),
        mkSnap('mid', 'unit', 200, { winRate: 0.5 }),
        mkSnap('newest', 'unit', 300, { winRate: 0.6 }),
      ].reverse(); // 최신이 앞
      const w: SimMetricWidget = {
        id: 'w', type: 'sim-metric', title: 'M',
        config: { snapshotId: 'latest', metricKey: 'winRate', domain: 'unit' },
      };
      const r = computeSimMetric(w, snaps);
      expect(r.snapshot?.id).toBe('newest');
      expect(r.value).toBe(0.6);
    });

    it('특정 id 모드', () => {
      const snaps = [
        mkSnap('a', 'unit', 100, { winRate: 0.4 }),
        mkSnap('b', 'unit', 200, { winRate: 0.6 }),
      ];
      const w: SimMetricWidget = {
        id: 'w', type: 'sim-metric', title: 'M',
        config: { snapshotId: 'a', metricKey: 'winRate' },
      };
      expect(computeSimMetric(w, snaps).value).toBe(0.4);
    });

    it('없는 metric = unknown status', () => {
      const snaps = [mkSnap('a', 'unit', 100, { winRate: 0.5 })];
      const w: SimMetricWidget = {
        id: 'w', type: 'sim-metric', title: 'M',
        config: { snapshotId: 'latest', metricKey: 'missing' },
      };
      const r = computeSimMetric(w, snaps);
      expect(r.value).toBeNull();
      expect(r.status).toBe('unknown');
    });

    it('threshold 기준 status', () => {
      const snaps = [mkSnap('a', 'unit', 100, { score: 85 })];
      const w: SimMetricWidget = {
        id: 'w', type: 'sim-metric', title: 'M',
        config: { snapshotId: 'latest', metricKey: 'score', threshold: { ok: 80, warn: 50 } },
      };
      expect(computeSimMetric(w, snaps).status).toBe('ok');

      const w2 = { ...w, config: { ...w.config, threshold: { ok: 90, warn: 70 } } };
      expect(computeSimMetric(w2, snaps).status).toBe('warn');

      const w3 = { ...w, config: { ...w.config, threshold: { ok: 95, warn: 90 } } };
      expect(computeSimMetric(w3, snaps).status).toBe('critical');
    });
  });

  describe('computeSimTrend (P10)', () => {
    const mkSnap = (id: string, createdAt: number, winRate: number): SimSnapshot => ({
      id, name: id, createdAt, domain: 'unit', config: {}, metrics: { winRate },
    });

    it('시간순 정렬', () => {
      const snaps = [
        mkSnap('c', 300, 0.6),
        mkSnap('a', 100, 0.4),
        mkSnap('b', 200, 0.5),
      ];
      const w: SimTrendWidget = {
        id: 'w', type: 'sim-trend', title: 'T',
        config: { metricKey: 'winRate' },
      };
      const pts = computeSimTrend(w, snaps);
      expect(pts.map((p) => p.snapshotId)).toEqual(['a', 'b', 'c']);
      expect(pts.map((p) => p.value)).toEqual([0.4, 0.5, 0.6]);
    });

    it('limit 은 가장 최근 N개', () => {
      const snaps = Array.from({ length: 30 }, (_, i) => mkSnap(`s${i}`, i * 100, i));
      const w: SimTrendWidget = {
        id: 'w', type: 'sim-trend', title: 'T',
        config: { metricKey: 'winRate', limit: 5 },
      };
      const pts = computeSimTrend(w, snaps);
      expect(pts.length).toBe(5);
      // 가장 최근 5개 (s25 ~ s29)
      expect(pts[0].snapshotId).toBe('s25');
      expect(pts[4].snapshotId).toBe('s29');
    });

    it('metricKey 없는 스냅샷은 제외', () => {
      const snaps: SimSnapshot[] = [
        { id: 'a', name: 'a', createdAt: 100, domain: 'unit', config: {}, metrics: { other: 1 } },
        { id: 'b', name: 'b', createdAt: 200, domain: 'unit', config: {}, metrics: { winRate: 0.5 } },
      ];
      const w: SimTrendWidget = {
        id: 'w', type: 'sim-trend', title: 'T',
        config: { metricKey: 'winRate' },
      };
      expect(computeSimTrend(w, snaps)).toHaveLength(1);
    });
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
