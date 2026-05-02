import { describe, it, expect } from 'vitest';
import { analyzeMove, checkComboLink, analyzeComboRoute, getCancelRoutes, MOVE_PRESETS } from './frameData';

describe('analyzeMove', () => {
  it('약 P 는 onHit +1, onBlock -1 (근사)', () => {
    const lp = MOVE_PRESETS[0]; // startup 4, active 3, recovery 7, hitstun 12, blockstun 10
    const a = analyzeMove(lp);
    expect(a.total).toBe(14);
    expect(a.onHit).toBe(5);      // 12 - 7
    expect(a.onBlock).toBe(3);    // 10 - 7
    expect(a.advantageHit).toBe('heavily-plus');
    expect(a.punishableOnBlock).toBe(false);
  });

  it('파동권 블록 시 heavily-minus + 펀시 가능', () => {
    const hado = MOVE_PRESETS[6]; // recovery 35, blockstun 15
    const a = analyzeMove(hado);
    expect(a.onBlock).toBe(-20);
    expect(a.advantageBlock).toBe('heavily-minus');
    expect(a.punishableOnBlock).toBe(true);
  });
});

describe('checkComboLink', () => {
  it('약 P → 중 P 기본 link (캔슬 없음) 은 -1 프레임 모자라 불가', () => {
    const link = checkComboLink(MOVE_PRESETS[0], MOVE_PRESETS[2]);
    // lp: hitstun 12 - recovery 7 = 5 남음. mp startup 6 → gap = -1
    expect(link.connects).toBe(false);
    expect(link.frameGap).toBe(-1);
  });

  it('약 P → 중 P 를 cancel 옵션으로 호출하면 recovery 생략 → 연결 됨', () => {
    const link = checkComboLink(MOVE_PRESETS[0], MOVE_PRESETS[2], { cancel: true });
    // cancel: recovery 0. hitstun 12 → gap = 12 - 6 = 6
    expect(link.connects).toBe(true);
    expect(link.frameGap).toBe(6);
    expect(link.cancel).toBe(true); // whitelist 에 포함 (lp.cancelsInto 에 mp 있음)
  });

  it('cancel: true 지만 whitelist 에 없는 기술은 cancel 플래그 false', () => {
    // hp.cancelsInto = [hadouken, shoryuken, super] — lp 는 없음
    const link = checkComboLink(MOVE_PRESETS[4], MOVE_PRESETS[0], { cancel: true });
    expect(link.cancel).toBe(false);
  });

  it('2번째 인자가 boolean 이면 counterHit 로 하위호환', () => {
    const link = checkComboLink(MOVE_PRESETS[0], MOVE_PRESETS[2], true);
    // CH extra 2f 추가 → remaining 7 - startup 6 = 1 → 연결
    expect(link.connects).toBe(true);
  });
});

describe('getCancelRoutes', () => {
  it('약 P → 여러 경로 생성 (gatling + special cancel)', () => {
    const lp = MOVE_PRESETS[0];
    const routes = getCancelRoutes(lp, MOVE_PRESETS, 3);
    // LP→MP / LP→HP / LP→hadouken / LP→shoryuken / LP→super 등 여러 루트
    expect(routes.length).toBeGreaterThan(3);
    // 모든 루트는 LP 로 시작
    for (const r of routes) {
      expect(r.moves[0].id).toBe('lp');
    }
  });

  it('강 P 에서는 special/super 만 나옴', () => {
    const hp = MOVE_PRESETS[4];
    const routes = getCancelRoutes(hp, MOVE_PRESETS, 2);
    const allTerminals = new Set(routes.map((r) => r.terminal.id));
    // HP → hadouken / shoryuken / super 만 가능
    for (const id of allTerminals) {
      expect(['hadouken', 'shoryuken', 'super']).toContain(id);
    }
  });

  it('maxDepth 제한 — 깊이 2 면 기술 2개짜리 루트만', () => {
    const lp = MOVE_PRESETS[0];
    const routes = getCancelRoutes(lp, MOVE_PRESETS, 2);
    for (const r of routes) {
      expect(r.moves.length).toBeLessThanOrEqual(2);
    }
  });

  it('캔슬 경로 없는 기술(super) 은 빈 루트', () => {
    const superMove = MOVE_PRESETS.find((m) => m.id === 'super')!;
    const routes = getCancelRoutes(superMove, MOVE_PRESETS);
    expect(routes).toEqual([]);
  });
});

describe('무적 / 카운터-히트', () => {
  it('승룡권 analyzeMove 에 invincibleRange 1-6f', () => {
    const shoryu = MOVE_PRESETS.find((m) => m.id === 'shoryuken')!;
    const a = analyzeMove(shoryu);
    expect(a.invincibleRange).not.toBeNull();
    expect(a.invincibleRange!.from).toBe(1);
    expect(a.invincibleRange!.to).toBe(6);
    expect(a.invincibleRange!.type).toBe('full');
  });

  it('카운터-히트 피해는 원본 × multiplier', () => {
    const shoryu = MOVE_PRESETS.find((m) => m.id === 'shoryuken')!;
    const a = analyzeMove(shoryu);
    expect(a.counterHitDamage).toBe(Math.round(120 * 1.2));
  });

  it('카운터-히트 onHit 는 일반보다 큼', () => {
    const lp = MOVE_PRESETS[0];
    const a = analyzeMove(lp);
    expect(a.counterHitOnHit).toBeGreaterThan(a.onHit);
  });

  it('카운터 히트 combo link 는 추가 hitstun 덕분에 더 쉽게 연결', () => {
    const from = MOVE_PRESETS[2]; // MP
    const to = MOVE_PRESETS[4];   // HP
    const normal = checkComboLink(from, to, false);
    const ch = checkComboLink(from, to, true);
    expect(ch.frameGap).toBeGreaterThanOrEqual(normal.frameGap);
  });
});

describe('analyzeComboRoute', () => {
  it('전체 피해는 각 기술 피해 합', () => {
    const route = analyzeComboRoute([MOVE_PRESETS[0], MOVE_PRESETS[2]]);
    expect(route.totalDamage).toBe(30 + 60);
  });

  it('analyzeComboRoute 는 cancelsInto whitelist 기반 자동 cancel 적용', () => {
    // 약P → 중P 는 순수 link 로는 -1 불가지만 lp.cancelsInto 에 mp 포함 → 자동 cancel → 연결
    const route = analyzeComboRoute([MOVE_PRESETS[0], MOVE_PRESETS[2]]);
    expect(route.feasible).toBe(true);
    expect(route.links[0].cancel).toBe(true);
  });

  it('cancel whitelist 에 없으면 link 판정대로 — 강 P → 약 P 불가', () => {
    // hp.cancelsInto = [hadouken, shoryuken, super] — lp 없음
    const route = analyzeComboRoute([MOVE_PRESETS[4], MOVE_PRESETS[0]]);
    expect(route.feasible).toBe(false);
    expect(route.links[0].cancel).toBe(false);
  });
});
