/**
 * 수식 프리셋 라이브러리
 * 자주 사용되는 게임 밸런싱 수식들
 */

export interface FormulaPreset {
  id: string;
  name: string;
  category: FormulaCategory;
  formula: string;
  description: string;
  example?: string;
  params?: FormulaParam[];
}

export interface FormulaParam {
  name: string;
  description: string;
  defaultValue: string;
}

export type FormulaCategory =
  | 'combat'      // 전투 계산
  | 'growth'      // 성장/레벨업
  | 'economy'     // 재화/경제
  | 'liveops'     // F2P 라이브 서비스 지표 (LTV/ARPU/Retention 등)
  | 'probability' // 확률 계산
  | 'stat'        // 스탯 계산
  | 'utility';    // 유틸리티

// 카테고리별 표시 정보
export const FORMULA_CATEGORIES: Record<FormulaCategory, { name: string; color: string }> = {
  combat: { name: '전투', color: 'var(--primary-red)' },
  growth: { name: '성장', color: 'var(--primary-green)' },
  economy: { name: '경제', color: 'var(--primary-yellow)' },
  liveops: { name: '라이브옵스', color: 'var(--primary-purple)' },
  probability: { name: '확률', color: 'var(--primary-purple)' },
  stat: { name: '스탯', color: 'var(--primary-blue)' },
  utility: { name: '유틸리티', color: 'var(--text-secondary)' },
};

// 수식 프리셋 목록
export const FORMULA_PRESETS: FormulaPreset[] = [
  // 전투 계산
  {
    id: 'damage_simple',
    name: '기본 데미지',
    category: 'combat',
    formula: '=DAMAGE({ATK}, {DEF})',
    description: '기본 데미지 공식 (ATK - DEF, 최소 1)',
    example: '공격력 100, 방어력 30 → 70 데미지',
    params: [
      { name: 'ATK', description: '공격력', defaultValue: 'B2' },
      { name: 'DEF', description: '방어력', defaultValue: 'C2' },
    ],
  },
  {
    id: 'damage_mmorpg',
    name: 'MMORPG 데미지',
    category: 'combat',
    formula: '={ATK} * (100 / (100 + {DEF}))',
    description: 'MMORPG 스타일 데미지 감소 (방어력 100 = 50% 감소)',
    example: '공격력 100, 방어력 100 → 50 데미지',
    params: [
      { name: 'ATK', description: '공격력', defaultValue: 'B2' },
      { name: 'DEF', description: '방어력', defaultValue: 'C2' },
    ],
  },
  {
    id: 'damage_percent',
    name: '퍼센트 감소 데미지',
    category: 'combat',
    formula: '={ATK} * (1 - MIN(0.9, {DEF} / 200))',
    description: '방어력을 퍼센트 감소로 적용 (최대 90% 감소)',
    example: '공격력 100, 방어력 100 → 50 데미지',
    params: [
      { name: 'ATK', description: '공격력', defaultValue: 'B2' },
      { name: 'DEF', description: '방어력', defaultValue: 'C2' },
    ],
  },
  {
    id: 'dps',
    name: 'DPS (초당 데미지)',
    category: 'combat',
    formula: '=DPS({ATK}, {SPEED})',
    description: '초당 데미지 출력',
    example: '공격력 50, 속도 2 → DPS 100',
    params: [
      { name: 'ATK', description: '공격력', defaultValue: 'B2' },
      { name: 'SPEED', description: '공격 속도', defaultValue: 'E2' },
    ],
  },
  {
    id: 'dps_crit',
    name: 'DPS (크리티컬 포함)',
    category: 'combat',
    formula: '={ATK} * {SPEED} * (1 + {CRIT_RATE} * ({CRIT_DMG} - 1))',
    description: '크리티컬을 포함한 기대 DPS',
    example: '크리율 30%, 크뎀 150% → DPS 15% 증가',
    params: [
      { name: 'ATK', description: '공격력', defaultValue: 'B2' },
      { name: 'SPEED', description: '공격 속도', defaultValue: 'E2' },
      { name: 'CRIT_RATE', description: '크리티컬 확률 (0-1)', defaultValue: 'F2' },
      { name: 'CRIT_DMG', description: '크리티컬 배율', defaultValue: 'G2' },
    ],
  },
  {
    id: 'ttk',
    name: 'TTK (처치 시간)',
    category: 'combat',
    formula: '=TTK({HP}, {DAMAGE}, {SPEED})',
    description: '적을 처치하는 데 걸리는 시간',
    example: 'HP 1000, 데미지 100, 속도 2 → 5초',
    params: [
      { name: 'HP', description: '대상 HP', defaultValue: 'A2' },
      { name: 'DAMAGE', description: '타격당 데미지', defaultValue: 'B2' },
      { name: 'SPEED', description: '공격 속도', defaultValue: 'E2' },
    ],
  },
  {
    id: 'ehp',
    name: 'EHP (유효 체력)',
    category: 'combat',
    formula: '=EHP({HP}, {DEF})',
    description: '방어력을 고려한 유효 체력',
    example: 'HP 1000, 방어력 100 → EHP 2000',
    params: [
      { name: 'HP', description: '체력', defaultValue: 'A2' },
      { name: 'DEF', description: '방어력', defaultValue: 'C2' },
    ],
  },

  // 성장/레벨업
  {
    id: 'exp_linear',
    name: '선형 경험치',
    category: 'growth',
    formula: '={BASE_EXP} + ({LEVEL} - 1) * {INCREMENT}',
    description: '레벨당 일정량 증가하는 경험치',
    example: '기본 100, 증가 50 → 레벨 10에 550',
    params: [
      { name: 'LEVEL', description: '레벨', defaultValue: 'A2' },
      { name: 'BASE_EXP', description: '기본 경험치', defaultValue: '100' },
      { name: 'INCREMENT', description: '레벨당 증가', defaultValue: '50' },
    ],
  },
  {
    id: 'exp_exponential',
    name: '지수 경험치',
    category: 'growth',
    formula: '={BASE_EXP} * POWER({RATE}, {LEVEL} - 1)',
    description: '기하급수적으로 증가하는 경험치',
    example: '기본 100, 배율 1.15 → 레벨 10에 352',
    params: [
      { name: 'LEVEL', description: '레벨', defaultValue: 'A2' },
      { name: 'BASE_EXP', description: '기본 경험치', defaultValue: '100' },
      { name: 'RATE', description: '증가 배율', defaultValue: '1.15' },
    ],
  },
  {
    id: 'stat_growth',
    name: '스탯 성장',
    category: 'growth',
    formula: '=ROUND({BASE_STAT} * POWER({GROWTH_RATE}, {LEVEL} - 1))',
    description: '레벨에 따른 스탯 성장',
    example: '기본 10, 성장률 1.1 → 레벨 10에 23',
    params: [
      { name: 'LEVEL', description: '레벨', defaultValue: 'A2' },
      { name: 'BASE_STAT', description: '기본 스탯', defaultValue: 'B2' },
      { name: 'GROWTH_RATE', description: '성장률', defaultValue: '1.1' },
    ],
  },
  {
    id: 'stat_scurve',
    name: 'S-커브 성장',
    category: 'growth',
    formula: '=SCURVE({LEVEL}, {MAX_LEVEL}, {MIN_STAT}, {MAX_STAT})',
    description: '초반/후반 완만, 중반 급격한 S커브 성장',
    example: '레벨 50/100, 10~100 → 55 스탯',
    params: [
      { name: 'LEVEL', description: '현재 레벨', defaultValue: 'A2' },
      { name: 'MAX_LEVEL', description: '최대 레벨', defaultValue: '100' },
      { name: 'MIN_STAT', description: '최소 스탯', defaultValue: '10' },
      { name: 'MAX_STAT', description: '최대 스탯', defaultValue: '100' },
    ],
  },

  // 경제
  {
    id: 'gold_reward',
    name: '골드 보상',
    category: 'economy',
    formula: '=ROUND({BASE_GOLD} * POWER({RATE}, {STAGE} - 1) * {MULTIPLIER})',
    description: '스테이지에 따른 골드 보상',
    example: '기본 10, 배율 1.2, 스테이지 5 → 20.7',
    params: [
      { name: 'STAGE', description: '스테이지', defaultValue: 'A2' },
      { name: 'BASE_GOLD', description: '기본 골드', defaultValue: '10' },
      { name: 'RATE', description: '증가율', defaultValue: '1.2' },
      { name: 'MULTIPLIER', description: '보너스 배율', defaultValue: '1' },
    ],
  },
  {
    id: 'upgrade_cost',
    name: '업그레이드 비용',
    category: 'economy',
    formula: '=ROUND({BASE_COST} * POWER({RATE}, {CURRENT_LEVEL}))',
    description: '레벨업 비용 (지수 증가)',
    example: '기본 100, 배율 1.5, 레벨 5 → 759',
    params: [
      { name: 'CURRENT_LEVEL', description: '현재 레벨', defaultValue: 'A2' },
      { name: 'BASE_COST', description: '기본 비용', defaultValue: '100' },
      { name: 'RATE', description: '증가율', defaultValue: '1.5' },
    ],
  },
  {
    id: 'inflation_curve',
    name: '인플레이션 곡선',
    category: 'economy',
    formula: '={BASE_VALUE} * (1 + {INFLATION_RATE} * (EXP({PROGRESS} * 3) - 1) / (EXP(3) - 1))',
    description: '후반으로 갈수록 급격히 증가하는 인플레이션',
    params: [
      { name: 'PROGRESS', description: '진행도 (0-1)', defaultValue: 'A2' },
      { name: 'BASE_VALUE', description: '기본값', defaultValue: '100' },
      { name: 'INFLATION_RATE', description: '최대 인플레이션', defaultValue: '10' },
    ],
  },

  // 확률 계산
  {
    id: 'gacha_expected',
    name: '가챠 기대값',
    category: 'probability',
    formula: '=1 / {DROP_RATE}',
    description: '원하는 아이템을 얻기 위한 평균 시도 횟수',
    example: '1% 확률 → 평균 100회 필요',
    params: [
      { name: 'DROP_RATE', description: '드랍 확률 (0-1)', defaultValue: '0.01' },
    ],
  },
  {
    id: 'gacha_pity',
    name: '천장 기대값',
    category: 'probability',
    formula: '=(1 - POWER(1 - {RATE}, {PITY})) / {RATE}',
    description: '천장 시스템이 있는 경우 기대 시도 횟수',
    params: [
      { name: 'RATE', description: '기본 확률', defaultValue: '0.006' },
      { name: 'PITY', description: '천장 횟수', defaultValue: '90' },
    ],
  },
  {
    id: 'crit_avg',
    name: '크리티컬 평균 배율',
    category: 'probability',
    formula: '=1 + {CRIT_RATE} * ({CRIT_DMG} - 1)',
    description: '크리티컬을 포함한 평균 데미지 배율',
    example: '크리율 50%, 크뎀 200% → 평균 1.5배',
    params: [
      { name: 'CRIT_RATE', description: '크리티컬 확률', defaultValue: 'F2' },
      { name: 'CRIT_DMG', description: '크리티컬 배율', defaultValue: 'G2' },
    ],
  },

  // 스탯 계산
  {
    id: 'attack_power',
    name: '최종 공격력',
    category: 'stat',
    formula: '=({BASE_ATK} + {FLAT_BONUS}) * (1 + {PERCENT_BONUS})',
    description: '고정값과 퍼센트 보너스를 적용한 최종 공격력',
    params: [
      { name: 'BASE_ATK', description: '기본 공격력', defaultValue: 'B2' },
      { name: 'FLAT_BONUS', description: '고정 보너스', defaultValue: '0' },
      { name: 'PERCENT_BONUS', description: '퍼센트 보너스', defaultValue: '0' },
    ],
  },
  {
    id: 'defense_reduction',
    name: '방어력 감소율',
    category: 'stat',
    formula: '={DEF} / ({DEF} + {CONSTANT})',
    description: '방어력에 따른 피해 감소율 (수확체감)',
    example: '방어 100, 상수 100 → 50% 감소',
    params: [
      { name: 'DEF', description: '방어력', defaultValue: 'C2' },
      { name: 'CONSTANT', description: '감소 상수', defaultValue: '100' },
    ],
  },
  {
    id: 'stat_efficiency',
    name: '스탯 효율',
    category: 'stat',
    formula: '=({STAT} / {COST}) * 100',
    description: '투자 대비 스탯 효율 (100 = 기준)',
    params: [
      { name: 'STAT', description: '얻는 스탯', defaultValue: 'B2' },
      { name: 'COST', description: '비용', defaultValue: 'C2' },
    ],
  },

  // 유틸리티
  {
    id: 'normalize',
    name: '정규화',
    category: 'utility',
    formula: '=({VALUE} - {MIN}) / ({MAX} - {MIN})',
    description: '값을 0~1 범위로 정규화',
    params: [
      { name: 'VALUE', description: '값', defaultValue: 'A2' },
      { name: 'MIN', description: '최솟값', defaultValue: '0' },
      { name: 'MAX', description: '최댓값', defaultValue: '100' },
    ],
  },
  {
    id: 'lerp',
    name: '선형 보간',
    category: 'utility',
    formula: '={MIN} + ({MAX} - {MIN}) * {T}',
    description: 'Min과 Max 사이를 T(0~1)로 보간',
    params: [
      { name: 'T', description: '보간값 (0-1)', defaultValue: 'A2' },
      { name: 'MIN', description: '최솟값', defaultValue: '0' },
      { name: 'MAX', description: '최댓값', defaultValue: '100' },
    ],
  },
  {
    id: 'clamp',
    name: '범위 제한',
    category: 'utility',
    formula: '=MAX({MIN}, MIN({MAX}, {VALUE}))',
    description: '값을 최소/최대 범위 내로 제한',
    params: [
      { name: 'VALUE', description: '값', defaultValue: 'A2' },
      { name: 'MIN', description: '최솟값', defaultValue: '0' },
      { name: 'MAX', description: '최댓값', defaultValue: '100' },
    ],
  },
  {
    id: 'round_to',
    name: '지정 자릿수 반올림',
    category: 'utility',
    formula: '=ROUND({VALUE} * POWER(10, {DIGITS})) / POWER(10, {DIGITS})',
    description: '소수점 아래 N자리로 반올림',
    params: [
      { name: 'VALUE', description: '값', defaultValue: 'A2' },
      { name: 'DIGITS', description: '소수점 자릿수', defaultValue: '2' },
    ],
  },

  // ───── 라이브옵스 (F2P 경제) ─────
  {
    id: 'ltv',
    name: 'LTV (Lifetime Value)',
    category: 'liveops',
    formula: '=LTV({ARPDAU}, {CHURN_DAILY})',
    description: '유저 1명의 이탈 전까지 예상 매출. ARPDAU / 일일 이탈률.',
    example: 'ARPDAU $0.20, daily churn 5% → LTV $4.00',
    params: [
      { name: 'ARPDAU', description: '일일 유저당 매출 ($)', defaultValue: 'B2' },
      { name: 'CHURN_DAILY', description: '일일 이탈률 (0-1)', defaultValue: '0.05' },
    ],
  },
  {
    id: 'arpu',
    name: 'ARPU (Average Revenue Per User)',
    category: 'liveops',
    formula: '=ARPU({REVENUE}, {USERS})',
    description: '기간 총 매출 / 유저 수.',
    params: [
      { name: 'REVENUE', description: '총 매출', defaultValue: 'B2' },
      { name: 'USERS', description: '유저 수', defaultValue: 'C2' },
    ],
  },
  {
    id: 'arpdau',
    name: 'ARPDAU',
    category: 'liveops',
    formula: '=ARPDAU({DAILY_REVENUE}, {DAU})',
    description: '일일 매출 / DAU. F2P 수익성 핵심.',
    params: [
      { name: 'DAILY_REVENUE', description: '일일 매출', defaultValue: 'B2' },
      { name: 'DAU', description: '일일 활성 유저', defaultValue: 'C2' },
    ],
  },
  {
    id: 'arppu',
    name: 'ARPPU (결제 유저당 매출)',
    category: 'liveops',
    formula: '=ARPPU({REVENUE}, {PAYING_USERS})',
    description: '매출 / 결제 유저. 과금 심도 지표.',
    params: [
      { name: 'REVENUE', description: '총 매출', defaultValue: 'B2' },
      { name: 'PAYING_USERS', description: '결제 유저 수', defaultValue: 'C2' },
    ],
  },
  {
    id: 'stickiness',
    name: 'Stickiness (DAU/MAU)',
    category: 'liveops',
    formula: '=STICKINESS({DAU}, {MAU})',
    description: '유저 접속 빈도 지표. 0.2 일반, 0.3 좋음, 0.5+ 훌륭.',
    params: [
      { name: 'DAU', description: '일일 활성 유저', defaultValue: 'B2' },
      { name: 'MAU', description: '월간 활성 유저', defaultValue: 'C2' },
    ],
  },
  {
    id: 'retention',
    name: 'Retention (N일차 잔존율)',
    category: 'liveops',
    formula: '=RETENTION({DAY1}, {N}, {LAMBDA})',
    description: '지수 감소 모델: R(n) = D1 × exp(-λ(n-1)).',
    params: [
      { name: 'DAY1', description: 'D1 잔존율 (0-1)', defaultValue: '0.4' },
      { name: 'N', description: '일차', defaultValue: '7' },
      { name: 'LAMBDA', description: '감소 상수', defaultValue: '0.05' },
    ],
  },
  {
    id: 'churn_rate',
    name: 'Churn Rate (이탈률)',
    category: 'liveops',
    formula: '=CHURN_RATE({RETENTION})',
    description: '1 - 잔존율.',
    params: [
      { name: 'RETENTION', description: '잔존율 (0-1)', defaultValue: 'B2' },
    ],
  },
  {
    id: 'k_factor',
    name: 'K-Factor (바이럴 계수)',
    category: 'liveops',
    formula: '=K_FACTOR({INVITES}, {CONV_RATE})',
    description: '유저 1명 평균 초대 수 × 초대 전환율. K≥1 이면 바이럴 성장.',
    params: [
      { name: 'INVITES', description: '평균 초대 수', defaultValue: '3' },
      { name: 'CONV_RATE', description: '초대 전환율 (0-1)', defaultValue: '0.2' },
    ],
  },
  {
    id: 'payback_period',
    name: 'Payback Period (회수 기간)',
    category: 'liveops',
    formula: '=PAYBACK_PERIOD({CAC}, {ARPDAU})',
    description: 'CAC / ARPDAU. 광고비 회수까지 걸리는 일수.',
    params: [
      { name: 'CAC', description: '고객 획득 비용', defaultValue: 'B2' },
      { name: 'ARPDAU', description: '일일 유저당 매출', defaultValue: 'C2' },
    ],
  },
  {
    id: 'cac',
    name: 'CAC (고객 획득 비용)',
    category: 'liveops',
    formula: '=CAC({AD_SPEND}, {NEW_USERS})',
    description: '광고비 / 신규 유저.',
    params: [
      { name: 'AD_SPEND', description: '광고비', defaultValue: 'B2' },
      { name: 'NEW_USERS', description: '신규 유저', defaultValue: 'C2' },
    ],
  },
  {
    id: 'roas',
    name: 'ROAS (광고비 대비 매출)',
    category: 'liveops',
    formula: '=ROAS({REVENUE}, {AD_SPEND})',
    description: '매출 / 광고비. 1.0 = 손익분기.',
    params: [
      { name: 'REVENUE', description: '매출', defaultValue: 'B2' },
      { name: 'AD_SPEND', description: '광고비', defaultValue: 'C2' },
    ],
  },
  {
    id: 'conversion_rate',
    name: 'Conversion Rate (전환율)',
    category: 'liveops',
    formula: '=CONVERSION_RATE({CONVERTED}, {TOTAL})',
    description: '전환 수 / 전체. 0-1로 클램프.',
    params: [
      { name: 'CONVERTED', description: '전환 수', defaultValue: 'B2' },
      { name: 'TOTAL', description: '전체 수', defaultValue: 'C2' },
    ],
  },
  {
    id: 'whale_curve',
    name: 'Whale Curve (고래 곡선)',
    category: 'liveops',
    formula: '=WHALE_CURVE({PERCENTILE}, {TOP_PCT}, {SHARE})',
    description: '파레토 분포. 상위 percentile 유저가 기여하는 누적 매출.',
    example: 'percentile 0.1, top 10%, share 50% → 50%',
    params: [
      { name: 'PERCENTILE', description: '상위 비율 (0-1)', defaultValue: '0.1' },
      { name: 'TOP_PCT', description: '기준 상위 비율', defaultValue: '0.1' },
      { name: 'SHARE', description: '기준 매출 점유율', defaultValue: '0.5' },
    ],
  },
  {
    id: 'funnel_conversion',
    name: 'Funnel Conversion (퍼널 전환)',
    category: 'liveops',
    formula: '=FUNNEL_CONVERSION({STEP1}, {STEP2}, {STEP3})',
    description: '각 단계 통과율의 곱.',
    params: [
      { name: 'STEP1', description: '1단계 전환율', defaultValue: '0.5' },
      { name: 'STEP2', description: '2단계 전환율', defaultValue: '0.3' },
      { name: 'STEP3', description: '3단계 전환율', defaultValue: '0.1' },
    ],
  },
  {
    id: 'cohort_retention',
    name: 'Cohort Retention (멱함수)',
    category: 'liveops',
    formula: '=COHORT_RETENTION({DAY1}, {DAY}, {P})',
    description: '멱함수 감소 모델. D1 × n^(-p). 모바일 p=0.5~0.7.',
    params: [
      { name: 'DAY1', description: 'D1 잔존율', defaultValue: '0.4' },
      { name: 'DAY', description: '일차', defaultValue: '30' },
      { name: 'P', description: '감소 지수', defaultValue: '0.6' },
    ],
  },
  {
    id: 'payback_curve',
    name: 'Payback Curve (누적 수익)',
    category: 'liveops',
    formula: '=PAYBACK_CURVE({ARPDAU}, {DAY1}, {DAYS}, {P})',
    description: 'N일까지 누적 ARPU × retention 합산.',
    params: [
      { name: 'ARPDAU', description: '일일 유저당 매출', defaultValue: '0.2' },
      { name: 'DAY1', description: 'D1 잔존율', defaultValue: '0.4' },
      { name: 'DAYS', description: '기간(일)', defaultValue: '30' },
      { name: 'P', description: '감소 지수', defaultValue: '0.6' },
    ],
  },
  {
    id: 'engagement_score',
    name: 'Engagement Score (참여도)',
    category: 'liveops',
    formula: '=ENGAGEMENT_SCORE({SESSION_MIN}, {SESSIONS_PER_DAY}, {DEPTH})',
    description: '세션 길이 × 빈도 × 깊이의 정규화 점수 (0-100).',
    params: [
      { name: 'SESSION_MIN', description: '세션 분', defaultValue: '15' },
      { name: 'SESSIONS_PER_DAY', description: '하루 세션 수', defaultValue: '3' },
      { name: 'DEPTH', description: '깊이 점수 (0-10)', defaultValue: '5' },
    ],
  },
  {
    id: 'elasticity',
    name: 'Price Elasticity (가격 탄력성)',
    category: 'liveops',
    formula: '=ELASTICITY({Q1}, {Q2}, {P1}, {P2})',
    description: '절댓값 >1 이면 탄력적 (가격 변화에 민감).',
    params: [
      { name: 'Q1', description: '기존 수량', defaultValue: '1000' },
      { name: 'Q2', description: '변경 후 수량', defaultValue: '800' },
      { name: 'P1', description: '기존 가격', defaultValue: '5' },
      { name: 'P2', description: '변경 후 가격', defaultValue: '7' },
    ],
  },
  {
    id: 'virality',
    name: 'Virality (바이럴 누적)',
    category: 'liveops',
    formula: '=VIRALITY({SEED}, {K}, {GENERATIONS})',
    description: '초기 시드에서 K세대 후 누적 유저 수. k<1이면 수렴.',
    params: [
      { name: 'SEED', description: '초기 유저', defaultValue: '100' },
      { name: 'K', description: 'K-factor', defaultValue: '0.5' },
      { name: 'GENERATIONS', description: '세대 수', defaultValue: '10' },
    ],
  },
  {
    id: 'margin',
    name: 'Margin (마진율)',
    category: 'liveops',
    formula: '=MARGIN({REVENUE}, {COST})',
    description: '(매출 - 비용) / 매출.',
    params: [
      { name: 'REVENUE', description: '매출', defaultValue: 'B2' },
      { name: 'COST', description: '비용', defaultValue: 'C2' },
    ],
  },
];

/**
 * 카테고리별 프리셋 그룹화
 */
export function getPresetsByCategory(): Record<FormulaCategory, FormulaPreset[]> {
  const grouped: Record<FormulaCategory, FormulaPreset[]> = {
    combat: [],
    growth: [],
    economy: [],
    liveops: [],
    probability: [],
    stat: [],
    utility: [],
  };

  for (const preset of FORMULA_PRESETS) {
    grouped[preset.category].push(preset);
  }

  return grouped;
}

/**
 * 프리셋 검색
 */
export function searchPresets(query: string): FormulaPreset[] {
  const lowerQuery = query.toLowerCase();
  return FORMULA_PRESETS.filter(preset =>
    preset.name.toLowerCase().includes(lowerQuery) ||
    preset.description.toLowerCase().includes(lowerQuery) ||
    preset.formula.toLowerCase().includes(lowerQuery)
  );
}

/**
 * 프리셋 수식에 파라미터 적용
 */
export function applyPresetParams(
  preset: FormulaPreset,
  params: Record<string, string>
): string {
  let formula = preset.formula;

  for (const [key, value] of Object.entries(params)) {
    formula = formula.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
  }

  return formula;
}
