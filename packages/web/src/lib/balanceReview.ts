/**
 * AI 밸런스 리뷰 (템플릿 기반).
 *
 * imbalanceDetector 의 ImbalanceIssue[] 결과를 사람이 읽는 자연어 리포트로 변환.
 * LLM 호출 없이 템플릿 합성 — 백엔드에서 추후 진짜 LLM 으로 교체 가능.
 *
 * 출력 구조:
 *   - summary: 1-2 줄 전체 평가
 *   - sections: severity 별 그룹 (critical/warning/info)
 *   - actionable: 즉시 적용 가능한 제안 top 5
 */

import type { ImbalanceIssue, ImbalanceType, Severity } from '@/lib/imbalanceDetector';

export interface BalanceReview {
  summary: string;
  /** 한 마디 헤드라인 (시트 상단 표시용) */
  headline: string;
  /** severity 별 그룹 — 자연어 단락 */
  sections: Array<{
    severity: Severity;
    title: string;
    body: string;
    issueCount: number;
  }>;
  /** 즉시 액션 가능한 제안 top 5 */
  actionable: string[];
  /** 메트릭 카드 */
  metrics: {
    total: number;
    critical: number;
    warning: number;
    info: number;
    score: number; // 0~100, 100 이 완벽
  };
}

const TYPE_LABEL: Record<ImbalanceType, string> = {
  outlier: '이상치',
  power_creep: '파워 크립',
  stat_dominance: '스탯 지배',
  dead_zone: '데드존',
  cliff: '난이도 절벽',
  diminishing: '수확체감 부재',
  correlation: '상관관계 이상',
  variance: '분산 문제',
  efficiency: '효율 불균형',
};

const TYPE_ADVICE: Record<ImbalanceType, string> = {
  outlier: '해당 행/컬럼의 값이 다른 항목 평균에서 크게 벗어납니다. 의도된 보스/유물이라면 명시적으로 분류하고, 그렇지 않으면 ±20% 범위로 조정을 검토하세요.',
  power_creep: '레벨이 올라갈수록 능력치가 기하급수적으로 증가합니다. 후반 콘텐츠 인플레이션 위험. 성장 곡선을 logarithmic 또는 power 곡선으로 완화하세요.',
  stat_dominance: '한 스탯이 다른 스탯보다 비용 대비 효율이 너무 높습니다. 다른 스탯에 의미있는 트레이드오프를 부여하거나 비용을 재조정하세요.',
  dead_zone: '특정 능력치 구간의 아이템/유닛이 비어있습니다. 플레이어가 그 구간을 건너뛰게 됨. 빈 구간을 채우는 신규 콘텐츠 추가를 검토하세요.',
  cliff: '연속된 레벨/단계 사이 난이도가 급격히 상승합니다. 플레이어 이탈 지점이 될 수 있어 중간 단계 추가 또는 곡선 완화가 필요합니다.',
  diminishing: '능력치 증가에 수확체감이 없어 후반에 폭주합니다. 로그 또는 √ 형태의 reduction 공식 도입을 검토하세요.',
  correlation: '있어야 할 (가격↑→성능↑) 같은 관계가 약하거나 반대입니다. 가격 책정 또는 능력치 재산정 필요.',
  variance: '같은 티어 내 항목들 사이 편차가 커서 어떤 선택은 다른 선택보다 명확히 우월합니다. 동일 티어는 ±15% 이내 편차로 정렬하세요.',
  efficiency: '비용 대비 효율이 일부 항목에 몰려 있어 메타픽이 발생합니다. 비효율 항목에 고유 효과를 부여하거나 비용을 낮추세요.',
};

/** severity 별 weight 로 점수 (100 이 완벽). */
function calculateScore(issues: ImbalanceIssue[]): number {
  let penalty = 0;
  for (const issue of issues) {
    if (issue.severity === 'critical') penalty += 15;
    else if (issue.severity === 'warning') penalty += 5;
    else penalty += 1;
  }
  return Math.max(0, 100 - penalty);
}

function summarizeSection(severity: Severity, issues: ImbalanceIssue[]): string {
  if (issues.length === 0) return '해당 등급의 이슈가 없습니다.';

  // 타입별 그룹화
  const byType = new Map<ImbalanceType, ImbalanceIssue[]>();
  for (const issue of issues) {
    if (!byType.has(issue.type)) byType.set(issue.type, []);
    byType.get(issue.type)!.push(issue);
  }

  const parts: string[] = [];
  byType.forEach((group, type) => {
    const cols = new Set(group.flatMap((g) => g.affectedColumns));
    const colsLabel = cols.size > 0 ? Array.from(cols).slice(0, 3).join(', ') : '';
    parts.push(
      `**${TYPE_LABEL[type]}** (${group.length}건${colsLabel ? ` · ${colsLabel}` : ''}): ${TYPE_ADVICE[type]}`
    );
  });

  return parts.join('\n\n');
}

function buildHeadline(score: number, total: number, critical: number): string {
  if (total === 0) return '검출된 이슈 없음 — 밸런스가 안정적입니다.';
  if (critical > 0) return `즉시 조치 필요 — 치명적 이슈 ${critical}건 (점수 ${score}/100)`;
  if (score >= 80) return `양호 — 미세 조정만 필요 (점수 ${score}/100, 이슈 ${total}건)`;
  if (score >= 60) return `보통 — 다음 패치에 정리 권장 (점수 ${score}/100, 이슈 ${total}건)`;
  return `개선 필요 — 광범위한 재조정 검토 (점수 ${score}/100, 이슈 ${total}건)`;
}

function buildSummary(metrics: BalanceReview['metrics']): string {
  if (metrics.total === 0) {
    return '분석 결과 즉각 조치가 필요한 불균형이 발견되지 않았습니다. 정량 지표는 안정적이지만, 시뮬레이션과 플레이테스트로 사용자 체감을 검증하는 것을 권장합니다.';
  }
  const parts: string[] = [];
  parts.push(`총 ${metrics.total}건의 잠재 이슈가 감지되었습니다.`);
  if (metrics.critical > 0) parts.push(`그중 **${metrics.critical}건은 치명적**으로, 출시 전 반드시 해결을 권장합니다.`);
  if (metrics.warning > 0) parts.push(`경고 수준 ${metrics.warning}건은 다음 패치 우선순위로 정리하세요.`);
  if (metrics.info > 0) parts.push(`정보성 ${metrics.info}건은 백로그 검토 항목입니다.`);
  parts.push(`전체 밸런스 점수는 **${metrics.score}/100**입니다.`);
  return parts.join(' ');
}

function buildActionable(issues: ImbalanceIssue[]): string[] {
  // critical → warning → info 순으로 상위 5개 추출
  const sorted = [...issues].sort((a, b) => {
    const order = { critical: 0, warning: 1, info: 2 };
    return order[a.severity] - order[b.severity];
  });
  return sorted.slice(0, 5).map((issue) => {
    const cols = issue.affectedColumns.length > 0 ? `[${issue.affectedColumns.join(', ')}] ` : '';
    return issue.suggestion
      ? `${cols}${issue.suggestion}`
      : `${cols}${issue.title} — ${TYPE_ADVICE[issue.type]}`;
  });
}

export function reviewBalance(issues: ImbalanceIssue[]): BalanceReview {
  const critical = issues.filter((i) => i.severity === 'critical');
  const warning = issues.filter((i) => i.severity === 'warning');
  const info = issues.filter((i) => i.severity === 'info');

  const metrics = {
    total: issues.length,
    critical: critical.length,
    warning: warning.length,
    info: info.length,
    score: calculateScore(issues),
  };

  return {
    summary: buildSummary(metrics),
    headline: buildHeadline(metrics.score, metrics.total, metrics.critical),
    sections: ([
      { severity: 'critical' as Severity, title: '치명적 (Critical)', body: summarizeSection('critical', critical), issueCount: critical.length },
      { severity: 'warning' as Severity, title: '경고 (Warning)', body: summarizeSection('warning', warning), issueCount: warning.length },
      { severity: 'info' as Severity, title: '정보 (Info)', body: summarizeSection('info', info), issueCount: info.length },
    ]).filter((s) => s.issueCount > 0),
    actionable: buildActionable(issues),
    metrics,
  };
}
