/**
 * F2P / 라이브서비스 게임 경제 수식.
 * 모바일/소셜/웹게임 밸런싱 & 수익성 분석용 핵심 지표들.
 *
 * 출처: GameAnalytics 벤치마크, Chartboost/Unity LevelPlay 리포트, AppsFlyer F2P 가이드.
 */

/**
 * LTV — Lifetime Value
 * 한 유저가 이탈 전까지 창출하는 총 예상 매출.
 * 공식: ARPDAU × 평균 수명 (1 / churnDaily)
 */
export function LTV(arpdau: number, churnDaily: number): number {
  if (churnDaily <= 0 || churnDaily >= 1) return Infinity;
  return arpdau / churnDaily;
}

/**
 * ARPU — Average Revenue Per User
 * 특정 기간 총 매출 / 총 유저 수.
 */
export function ARPU(totalRevenue: number, totalUsers: number): number {
  if (totalUsers <= 0) return 0;
  return totalRevenue / totalUsers;
}

/**
 * ARPDAU — Average Revenue Per Daily Active User
 * 일일 매출 / DAU. F2P 수익성 핵심 지표.
 */
export function ARPDAU(dailyRevenue: number, dau: number): number {
  if (dau <= 0) return 0;
  return dailyRevenue / dau;
}

/**
 * ARPPU — Average Revenue Per Paying User
 * 매출 / 결제 유저. 과금 심도.
 */
export function ARPPU(totalRevenue: number, payingUsers: number): number {
  if (payingUsers <= 0) return 0;
  return totalRevenue / payingUsers;
}

/**
 * STICKINESS — DAU/MAU 비율
 * 0.2 = 일반, 0.3 = 좋음, 0.5+ = 훌륭 (SNS급).
 */
export function STICKINESS(dau: number, mau: number): number {
  if (mau <= 0) return 0;
  return Math.min(1, dau / mau);
}

/**
 * RETENTION — N일차 잔존율
 * 지수 감소 모델: R(n) = R(1) × exp(-λ × (n-1)).
 * lambda 는 이탈 상수.
 */
export function RETENTION(day1: number, n: number, lambda: number = 0.05): number {
  if (n <= 1) return day1;
  return day1 * Math.exp(-lambda * (n - 1));
}

/**
 * CHURN_RATE — 이탈률
 * 1 - 잔존율.
 */
export function CHURN_RATE(retention: number): number {
  return Math.max(0, Math.min(1, 1 - retention));
}

/**
 * K_FACTOR — 바이럴 계수
 * 한 유저가 평균 몇 명을 초대하고 그중 몇 명이 전환하는가.
 * K >= 1 이면 바이럴 성장.
 */
export function K_FACTOR(invitesPerUser: number, conversionRate: number): number {
  return invitesPerUser * Math.max(0, Math.min(1, conversionRate));
}

/**
 * PAYBACK_PERIOD — 회수 기간 (일)
 * CAC 를 ARPDAU 로 나눈 값.
 */
export function PAYBACK_PERIOD(cac: number, arpdau: number): number {
  if (arpdau <= 0) return Infinity;
  return cac / arpdau;
}

/**
 * CAC — 고객 획득 비용
 * 광고비 / 신규 유저.
 */
export function CAC(adSpend: number, newUsers: number): number {
  if (newUsers <= 0) return 0;
  return adSpend / newUsers;
}

/**
 * ROAS — Return On Ad Spend
 * 매출 / 광고비. 1.0 = 손익분기.
 */
export function ROAS(revenue: number, adSpend: number): number {
  if (adSpend <= 0) return 0;
  return revenue / adSpend;
}

/**
 * CONVERSION_RATE — 전환율
 * 단순 비율, 0-1 범위 클램프.
 */
export function CONVERSION_RATE(converted: number, total: number): number {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(1, converted / total));
}

/**
 * WHALE_CURVE — 파레토 기반 과금 분포 (80/20 또는 90/10 커스텀).
 * 상위 topPercent(%) 유저가 전체 매출의 shareOfRevenue(%) 를 차지할 때,
 * 특정 percentile 위치의 유저가 기여하는 누적 매출 비율 반환.
 *
 * @param percentile 0~1 (상위부터). 0 = 가장 큰 고래.
 * @param topPercent 기준 상위 비율 (기본 0.1 = 상위 10%)
 * @param shareOfRevenue 기준 매출 점유율 (기본 0.5 = 50%)
 */
export function WHALE_CURVE(
  percentile: number,
  topPercent: number = 0.1,
  shareOfRevenue: number = 0.5
): number {
  const clamped = Math.max(0, Math.min(1, percentile));
  // F(x) = x^α 형태. α = log(share)/log(topPercent) 가 조건 F(topPercent)=shareOfRevenue 만족.
  // α<1 이면 볼록 → 상위 소수가 매출의 다수를 차지 (80/20 규칙).
  const alpha = Math.log(shareOfRevenue) / Math.log(topPercent);
  return Math.pow(clamped, alpha);
}

/**
 * FUNNEL_CONVERSION — 다단계 퍼널 전환율
 * 각 단계 통과율의 곱.
 */
export function FUNNEL_CONVERSION(...stepRates: number[]): number {
  return stepRates.reduce((acc, r) => acc * Math.max(0, Math.min(1, r)), 1);
}

/**
 * COHORT_RETENTION — 코호트 잔존 곡선 (멱함수 감소)
 * r(n) = day1 × n^(-p).
 * p=0.5 ~ 0.7 이 일반 모바일 게임 범위.
 */
export function COHORT_RETENTION(day1: number, day: number, p: number = 0.6): number {
  if (day <= 0) return day1;
  if (day <= 1) return day1;
  return day1 * Math.pow(day, -p);
}

/**
 * PAYBACK_CURVE — 누적 수익 곡선
 * N일까지 누적 ARPU 합산 (retention 가중).
 */
export function PAYBACK_CURVE(
  arpdau: number,
  day1: number,
  days: number,
  p: number = 0.6
): number {
  let cum = 0;
  for (let d = 1; d <= days; d++) {
    const ret = COHORT_RETENTION(day1, d, p);
    cum += arpdau * ret;
  }
  return cum;
}

/**
 * ENGAGEMENT_SCORE — 참여도 점수 (0-100)
 * 세션 길이 × 빈도 × 플레이 깊이의 정규화 가중합.
 */
export function ENGAGEMENT_SCORE(
  sessionMinutes: number,
  sessionsPerDay: number,
  depthScore: number,
  maxSession: number = 60,
  maxSessionsPerDay: number = 10,
  maxDepth: number = 10
): number {
  const s = Math.min(1, sessionMinutes / maxSession);
  const f = Math.min(1, sessionsPerDay / maxSessionsPerDay);
  const d = Math.min(1, depthScore / maxDepth);
  return Math.round((s * 0.4 + f * 0.4 + d * 0.2) * 100);
}

/**
 * ELASTICITY — 가격 탄력성
 * (수량 변화율) / (가격 변화율). 절댓값 >1 = 탄력적.
 */
export function ELASTICITY(
  q1: number,
  q2: number,
  p1: number,
  p2: number
): number {
  if (q1 <= 0 || p1 <= 0) return 0;
  const dq = (q2 - q1) / q1;
  const dp = (p2 - p1) / p1;
  if (dp === 0) return 0;
  return dq / dp;
}

/**
 * VIRALITY — n세대 후 누적 유저 수
 * seed × (1 + k + k² + ... + k^n). k<1 이면 수렴.
 */
export function VIRALITY(seed: number, k: number, generations: number): number {
  if (k < 0 || generations < 0) return seed;
  if (k === 1) return seed * (generations + 1);
  return seed * (1 - Math.pow(k, generations + 1)) / (1 - k);
}

/**
 * MARGIN — 마진율
 * (매출 - 비용) / 매출.
 */
export function MARGIN(revenue: number, cost: number): number {
  if (revenue <= 0) return 0;
  return (revenue - cost) / revenue;
}
