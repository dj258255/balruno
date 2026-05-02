import { describe, it, expect } from 'vitest';
import { runMatchupMatrix, winRateToColor, type MatchupRunner } from './matchupMatrix';

interface MockFighter {
  id: string;
  name: string;
  power: number;
}

// 결정론적 runner: 더 높은 power 가 무조건 이김 (noise 없음 → 테스트 예측 가능)
const deterministicRunner: MatchupRunner<MockFighter> = {
  id: (f) => f.id,
  label: (f) => f.name,
  runMatch: (a, b) => {
    if (a.power > b.power) return 'a';
    if (b.power > a.power) return 'b';
    return 'draw';
  },
};

describe('runMatchupMatrix', () => {
  it('대각선은 0.5 (자기 자신과의 대결)', () => {
    const fighters: MockFighter[] = [
      { id: 'a', name: 'A', power: 100 },
      { id: 'b', name: 'B', power: 50 },
    ];
    const result = runMatchupMatrix(fighters, deterministicRunner, { runsPerMatch: 20 });
    expect(result.winRates[0][0]).toBe(0.5);
    expect(result.winRates[1][1]).toBe(0.5);
  });

  it('대칭성: winRates[i][j] + winRates[j][i] = 1', () => {
    const fighters: MockFighter[] = [
      { id: 'a', name: 'A', power: 100 },
      { id: 'b', name: 'B', power: 50 },
      { id: 'c', name: 'C', power: 75 },
    ];
    const r = runMatchupMatrix(fighters, deterministicRunner, { runsPerMatch: 20 });
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        if (i === j) continue;
        expect(r.winRates[i][j] + r.winRates[j][i]).toBeCloseTo(1, 5);
      }
    }
  });

  it('모든 상대 이기는 쪽은 dominantIdx 에 포함', () => {
    const fighters: MockFighter[] = [
      { id: 'strong', name: 'Strong', power: 1000 },
      { id: 'mid',    name: 'Mid',    power: 50 },
      { id: 'weak',   name: 'Weak',   power: 10 },
    ];
    const r = runMatchupMatrix(fighters, deterministicRunner, { runsPerMatch: 10 });
    expect(r.dominantIdx).toContain(0); // Strong
    expect(r.weakIdx).toContain(2);     // Weak
  });

  it('3 가위바위보 cycle 감지 (A>B>C>A)', () => {
    // 수동으로 cycle 유도하는 runner
    const rps: MatchupRunner<{ id: string; name: string; type: 'rock' | 'paper' | 'scissors' }> = {
      id: (x) => x.id,
      label: (x) => x.name,
      runMatch: (a, b) => {
        if (a.type === b.type) return 'draw';
        const wins =
          (a.type === 'rock'     && b.type === 'scissors') ||
          (a.type === 'paper'    && b.type === 'rock') ||
          (a.type === 'scissors' && b.type === 'paper');
        return wins ? 'a' : 'b';
      },
    };
    const items = [
      { id: 'r', name: 'Rock',     type: 'rock'     as const },
      { id: 'p', name: 'Paper',    type: 'paper'    as const },
      { id: 's', name: 'Scissors', type: 'scissors' as const },
    ];
    const r = runMatchupMatrix(items, rps, { runsPerMatch: 5 });
    expect(r.cycles.length).toBe(1);
    expect(r.cycles[0].sort()).toEqual([0, 1, 2]);
  });

  it('완벽 밸런스 (모두 50:50 랜덤) 는 balanceScore 높음', () => {
    const coin: MatchupRunner<{ id: string; name: string }> = {
      id: (x) => x.id,
      label: (x) => x.name,
      runMatch: () => (Math.random() < 0.5 ? 'a' : 'b'),
    };
    const items = [
      { id: '1', name: '1' }, { id: '2', name: '2' },
      { id: '3', name: '3' }, { id: '4', name: '4' },
    ];
    const r = runMatchupMatrix(items, coin, { runsPerMatch: 200 });
    // 모두 거의 50:50 → dominant/weak 없음 → score 80+
    expect(r.dominantIdx).toHaveLength(0);
    expect(r.weakIdx).toHaveLength(0);
    expect(r.balanceScore).toBeGreaterThanOrEqual(70);
  });

  it('극심한 불균형은 balanceScore 낮음', () => {
    const items: MockFighter[] = [
      { id: 'god',  name: 'God',  power: 9999 },
      { id: 'bug',  name: 'Bug',  power: 1 },
      { id: 'bug2', name: 'Bug2', power: 1 },
    ];
    const r = runMatchupMatrix(items, deterministicRunner, { runsPerMatch: 10 });
    expect(r.balanceScore).toBeLessThanOrEqual(60);
  });

  it('avgWinRate 자기 자신 제외하고 평균', () => {
    const items: MockFighter[] = [
      { id: 'a', name: 'A', power: 100 },
      { id: 'b', name: 'B', power: 10 },
    ];
    const r = runMatchupMatrix(items, deterministicRunner, { runsPerMatch: 5 });
    // A 는 B 에게 100% 승리 → avg 1.0
    expect(r.avgWinRate[0]).toBe(1);
    expect(r.avgWinRate[1]).toBe(0);
  });

  it('topImbalances 는 승률 차이 큰 순으로 정렬', () => {
    const items: MockFighter[] = [
      { id: 'a', name: 'A', power: 100 },
      { id: 'b', name: 'B', power: 90 },   // A vs B → A 승 (차이 큼)
      { id: 'c', name: 'C', power: 95 },
    ];
    const r = runMatchupMatrix(items, deterministicRunner, { runsPerMatch: 5 });
    // 전부 불균형이지만 sort 가 desc 로 되어있나 확인
    for (let i = 1; i < r.topImbalances.length; i++) {
      const prev = Math.abs(r.topImbalances[i - 1].winRate - 0.5);
      const curr = Math.abs(r.topImbalances[i].winRate - 0.5);
      expect(prev).toBeGreaterThanOrEqual(curr);
    }
  });
});

describe('winRateToColor', () => {
  it('50% 근처는 거의 투명', () => {
    const c = winRateToColor(0.5);
    expect(c).toMatch(/rgba\(\d+, \d+, \d+, 0(\.0+)?\)/);
  });

  it('승률 높으면 빨강 계열', () => {
    const c = winRateToColor(0.9);
    expect(c).toContain('239, 68, 68');
  });

  it('승률 낮으면 파랑 계열', () => {
    const c = winRateToColor(0.1);
    expect(c).toContain('59, 130, 246');
  });
});
