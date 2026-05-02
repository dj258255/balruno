import { describe, it, expect } from 'vitest';
import { runPlaytest, type PlaytestScenario } from './aiPlaytest';

describe('runPlaytest', () => {
  it('빈 시나리오 — 빈 report', async () => {
    const r = await runPlaytest([]);
    expect(r.scenarios).toHaveLength(0);
    expect(r.totalIssues).toBe(0);
    expect(r.overallScore).toBe(100);
  });

  it('단일 시나리오 정상 — issues 0', async () => {
    const scenario: PlaytestScenario = {
      id: 's1',
      name: '정상 시나리오',
      domain: 'unit',
      runs: 5,
      run: () => ({ winRate: 0.5 }),
      validators: [
        { metricKey: 'winRate', expected: [0.4, 0.6], severity: 'warn', label: 'WR' },
      ],
    };
    const r = await runPlaytest([scenario]);
    expect(r.scenarios).toHaveLength(1);
    expect(r.scenarios[0].issues).toHaveLength(0);
    expect(r.totalIssues).toBe(0);
    expect(r.overallScore).toBe(100);
  });

  it('범위 벗어나면 issue 등록', async () => {
    const scenario: PlaytestScenario = {
      id: 's2',
      name: '편향',
      domain: 'fps',
      runs: 3,
      run: () => ({ winRate: 0.9 }),  // 40-60 기대인데 90% → 범위 밖
      validators: [
        { metricKey: 'winRate', expected: [0.4, 0.6], severity: 'critical', label: 'WR' },
      ],
    };
    const r = await runPlaytest([scenario]);
    expect(r.scenarios[0].issues).toHaveLength(1);
    expect(r.scenarios[0].issues[0].severity).toBe('critical');
    expect(r.criticalCount).toBe(1);
    expect(r.overallScore).toBeLessThan(100);
  });

  it('domainHealth 는 최악 심각도 집계', async () => {
    const scenario: PlaytestScenario = {
      id: 's3',
      name: 'multi',
      domain: 'deck',
      runs: 2,
      run: () => ({ clearRate: 0.1 }),
      validators: [
        { metricKey: 'clearRate', expected: [0.7, 1.0], severity: 'critical', label: 'clear' },
      ],
    };
    const r = await runPlaytest([scenario]);
    expect(r.domainHealth.deck).toBe('critical');
    expect(r.domainHealth.fps).toBe('ok');  // 미사용 도메인
  });

  it('여러 run 집계 — avg/min/max/stdev', async () => {
    let count = 0;
    const scenario: PlaytestScenario = {
      id: 's4',
      name: '다중',
      domain: 'unit',
      runs: 5,
      run: () => {
        count++;
        return { x: count };  // 1, 2, 3, 4, 5
      },
      validators: [],
    };
    const r = await runPlaytest([scenario]);
    const m = r.scenarios[0].metrics.x;
    expect(m.avg).toBe(3);
    expect(m.min).toBe(1);
    expect(m.max).toBe(5);
    expect(m.stdev).toBeGreaterThan(0);
  });

  it('overallScore: warn 은 -5, critical 은 -15', async () => {
    const scenarios: PlaytestScenario[] = [
      {
        id: 'c', name: 'c', domain: 'unit', runs: 1,
        run: () => ({ x: 10 }),
        validators: [{ metricKey: 'x', expected: [0, 1], severity: 'critical', label: 'x' }],
      },
      {
        id: 'w', name: 'w', domain: 'fps', runs: 1,
        run: () => ({ x: 10 }),
        validators: [{ metricKey: 'x', expected: [0, 1], severity: 'warn', label: 'x' }],
      },
    ];
    const r = await runPlaytest(scenarios);
    // 100 - 15 - 5 = 80
    expect(r.overallScore).toBe(80);
  });

  it('비동기 run 함수 지원', async () => {
    const scenario: PlaytestScenario = {
      id: 'async', name: 'async', domain: 'unit', runs: 3,
      run: async () => {
        await new Promise((r) => setTimeout(r, 0));
        return { x: 1 };
      },
      validators: [],
    };
    const r = await runPlaytest([scenario]);
    expect(r.scenarios[0].runCount).toBe(3);
  });
});
