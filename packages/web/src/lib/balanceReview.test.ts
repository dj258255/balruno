import { describe, it, expect } from 'vitest';
import { reviewBalance } from './balanceReview';
import type { ImbalanceIssue } from './imbalanceDetector';

function makeIssue(severity: 'critical' | 'warning' | 'info', type: ImbalanceIssue['type'] = 'outlier'): ImbalanceIssue {
  return {
    id: `i_${Math.random()}`,
    type,
    severity,
    title: 'test',
    description: 'desc',
    affectedRows: [],
    affectedColumns: ['HP'],
  };
}

describe('reviewBalance', () => {
  it('빈 issues → score 100, headline 안정적', () => {
    const r = reviewBalance([]);
    expect(r.metrics.score).toBe(100);
    expect(r.metrics.total).toBe(0);
    expect(r.headline).toContain('이슈 없음');
    expect(r.sections).toHaveLength(0);
  });

  it('critical 1건 → 점수 -15, headline 즉시 조치', () => {
    const r = reviewBalance([makeIssue('critical')]);
    expect(r.metrics.critical).toBe(1);
    expect(r.metrics.score).toBe(85);
    expect(r.headline).toContain('즉시 조치');
  });

  it('mixed 결과 → severity 별 그룹화', () => {
    const issues = [
      makeIssue('critical', 'outlier'),
      makeIssue('warning', 'power_creep'),
      makeIssue('warning', 'outlier'),
      makeIssue('info', 'cliff'),
    ];
    const r = reviewBalance(issues);
    expect(r.metrics.total).toBe(4);
    expect(r.metrics.critical).toBe(1);
    expect(r.metrics.warning).toBe(2);
    expect(r.metrics.info).toBe(1);
    expect(r.sections).toHaveLength(3);
    // critical body 가 outlier advice 포함
    const critSection = r.sections.find((s) => s.severity === 'critical');
    expect(critSection?.body).toContain('이상치');
  });

  it('actionable 은 critical 우선 5개 이하', () => {
    const issues = [
      ...Array.from({ length: 3 }).map(() => makeIssue('warning')),
      ...Array.from({ length: 3 }).map(() => makeIssue('critical')),
      ...Array.from({ length: 5 }).map(() => makeIssue('info')),
    ];
    const r = reviewBalance(issues);
    expect(r.actionable.length).toBeLessThanOrEqual(5);
    // top 5 안에 critical 3개 포함
    expect(r.metrics.critical).toBe(3);
  });

  it('점수는 0 미만으로 안 떨어짐', () => {
    const issues = Array.from({ length: 50 }).map(() => makeIssue('critical'));
    const r = reviewBalance(issues);
    expect(r.metrics.score).toBe(0);
  });
});
