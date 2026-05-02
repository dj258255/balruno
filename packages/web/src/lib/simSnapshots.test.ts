import { describe, it, expect, beforeEach } from 'vitest';
import {
  saveSnapshot,
  loadSnapshots,
  deleteSnapshot,
  renameSnapshot,
  clearAllSnapshots,
  diffSnapshots,
  classifyChange,
  inferDirection,
  type SimSnapshot,
} from './simSnapshots';

// vitest jsdom env 가 localStorage 제공
beforeEach(() => {
  clearAllSnapshots();
});

describe('스냅샷 CRUD', () => {
  it('저장 후 불러오면 데이터 동일', () => {
    const snap = saveSnapshot({
      name: '테스트',
      domain: 'unit',
      config: { unit: 'A', power: 100 },
      metrics: { winRate: 0.55, avgDps: 85 },
    });
    const list = loadSnapshots();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(snap.id);
    expect(list[0].metrics.winRate).toBe(0.55);
  });

  it('복수 저장 시 최신이 앞 (unshift)', () => {
    saveSnapshot({ name: 'first', domain: 'unit', config: {}, metrics: {} });
    saveSnapshot({ name: 'second', domain: 'unit', config: {}, metrics: {} });
    const list = loadSnapshots();
    expect(list[0].name).toBe('second');
    expect(list[1].name).toBe('first');
  });

  it('50개 초과 시 가장 오래된게 삭제됨', () => {
    for (let i = 0; i < 55; i++) {
      saveSnapshot({ name: `s${i}`, domain: 'unit', config: {}, metrics: {} });
    }
    const list = loadSnapshots();
    expect(list).toHaveLength(50);
    // 최신 5개만 남음. s54 가 맨 앞
    expect(list[0].name).toBe('s54');
    // s0~s4 는 증발
    expect(list.some((s) => s.name === 's0')).toBe(false);
  });

  it('delete 는 해당 id 만 제거', () => {
    const a = saveSnapshot({ name: 'a', domain: 'unit', config: {}, metrics: {} });
    const b = saveSnapshot({ name: 'b', domain: 'unit', config: {}, metrics: {} });
    deleteSnapshot(a.id);
    const list = loadSnapshots();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(b.id);
  });

  it('rename 은 name 만 변경', () => {
    const s = saveSnapshot({ name: 'old', domain: 'unit', config: {}, metrics: {} });
    renameSnapshot(s.id, 'new');
    const [updated] = loadSnapshots();
    expect(updated.name).toBe('new');
    expect(updated.id).toBe(s.id);
  });
});

describe('diffSnapshots', () => {
  const mkSnap = (metrics: Record<string, number>): SimSnapshot => ({
    id: Math.random().toString(),
    name: 't',
    createdAt: Date.now(),
    domain: 'unit',
    config: {},
    metrics,
  });

  it('공통 key 만 비교 대상', () => {
    const before = mkSnap({ winRate: 0.4, ttk: 2000, onlyBefore: 10 });
    const after  = mkSnap({ winRate: 0.6, ttk: 1500, onlyAfter: 20 });
    const diff = diffSnapshots(before, after);
    expect(diff.keys.sort()).toEqual(['ttk', 'winRate']);
    // onlyBefore/onlyAfter 는 빠짐
  });

  it('delta = after - before', () => {
    const before = mkSnap({ winRate: 0.4 });
    const after  = mkSnap({ winRate: 0.55 });
    const diff = diffSnapshots(before, after);
    expect(diff.rows[0].delta).toBeCloseTo(0.15, 5);
    expect(diff.rows[0].deltaPct).toBeCloseTo(37.5, 2);
  });

  it('before 가 0 이면 deltaPct 는 null', () => {
    const before = mkSnap({ x: 0 });
    const after  = mkSnap({ x: 10 });
    expect(diffSnapshots(before, after).rows[0].deltaPct).toBeNull();
  });
});

describe('classifyChange', () => {
  it('higher-better: 양수 delta = improved', () => {
    expect(classifyChange(0.1, 'higher-better')).toBe('improved');
    expect(classifyChange(-0.1, 'higher-better')).toBe('regressed');
  });

  it('lower-better: 음수 delta = improved (TTK 감소)', () => {
    expect(classifyChange(-100, 'lower-better')).toBe('improved');
    expect(classifyChange(100, 'lower-better')).toBe('regressed');
  });

  it('threshold 내면 neutral', () => {
    expect(classifyChange(0.005, 'higher-better')).toBe('neutral');
  });
});

describe('inferDirection', () => {
  it('TTK/duration/deadHand 는 낮을수록 좋음', () => {
    expect(inferDirection('avgTTK')).toBe('lower-better');
    expect(inferDirection('avgDuration')).toBe('lower-better');
    expect(inferDirection('deadHandRate')).toBe('lower-better');
  });

  it('winRate/dpt 등은 높을수록 좋음 (기본값)', () => {
    expect(inferDirection('winRate')).toBe('higher-better');
    expect(inferDirection('avgDPT')).toBe('higher-better');
  });
});
