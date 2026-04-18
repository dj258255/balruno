/**
 * 게임 밸런스 전용 수식 — Balruno의 핵심 해자.
 * Airtable/Excel엔 없는 게임 도메인 내장 함수들.
 */

/**
 * SCALE - 레벨 스케일링 함수
 * @param base 기본값
 * @param level 레벨
 * @param rate 성장률
 * @param curveType 곡선 타입 (linear, exponential, logarithmic, quadratic, scurve)
 * @param options 추가 옵션 (S-curve용 max, mid)
 */
export function SCALE(
  base: number,
  level: number,
  rate: number,
  curveType: string = 'linear',
  options?: { max?: number; mid?: number }
): number {
  switch (curveType.toLowerCase()) {
    case 'linear':
      return base + level * rate;
    case 'exponential':
      return base * Math.pow(rate, level);
    case 'logarithmic':
      return base + rate * Math.log(Math.max(1, level));
    case 'quadratic':
      return base + rate * level * level;
    case 'scurve':
    case 's-curve': {
      const max = options?.max ?? 100;
      const mid = options?.mid ?? 50;
      return base + max / (1 + Math.exp(-rate * (level - mid)));
    }
    default:
      return base + level * rate;
  }
}

/**
 * DAMAGE - 데미지 계산 (감소율 공식)
 * 일반적인 공식: ATK * (100 / (100 + DEF))
 */
export function DAMAGE(atk: number, def: number, multiplier: number = 1): number {
  return atk * (100 / (100 + def)) * multiplier;
}

/**
 * DPS - 초당 데미지 (크리티컬 포함)
 */
export function DPS(
  damage: number,
  attackSpeed: number,
  critRate: number = 0,
  critDamage: number = 2
): number {
  const effectiveDamage = damage * (1 + critRate * (critDamage - 1));
  return effectiveDamage * attackSpeed;
}

/**
 * TTK - Time To Kill
 */
export function TTK(targetHP: number, damage: number, attackSpeed: number): number {
  if (damage <= 0 || attackSpeed <= 0) return Infinity;
  const hitsNeeded = Math.ceil(targetHP / damage);
  // 마지막 공격은 쿨다운이 없음
  return (hitsNeeded - 1) / attackSpeed;
}

/**
 * EHP - 유효 체력 (방어력/피해 감소 반영)
 */
export function EHP(hp: number, def: number, damageReduction: number = 0): number {
  const defMultiplier = 1 + def / 100;
  const reductionMultiplier = 1 / (1 - Math.min(damageReduction, 0.99));
  return hp * defMultiplier * reductionMultiplier;
}

/**
 * DROP_RATE - 드랍 확률 보정 (행운/레벨 차이 반영)
 */
export function DROP_RATE(baseRate: number, luck: number = 0, levelDiff: number = 0): number {
  // 행운 100 = 2배
  const luckMultiplier = 1 + luck / 100;
  // 10레벨 차이 = 50% 감소
  const levelMultiplier = Math.max(0.1, 1 - levelDiff * 0.05);
  return Math.min(1, baseRate * luckMultiplier * levelMultiplier);
}

/**
 * GACHA_PITY - 가챠 천장 확률 (소프트 천장 구간에서 점진적 증가)
 */
export function GACHA_PITY(
  baseRate: number,
  currentPull: number,
  softPityStart: number = 74,
  hardPity: number = 90
): number {
  if (currentPull >= hardPity) return 1;
  if (currentPull < softPityStart) return baseRate;

  const pullsIntoPity = currentPull - softPityStart;
  const maxPityPulls = hardPity - softPityStart;
  const pityBonus = (1 - baseRate) * (pullsIntoPity / maxPityPulls) * 0.5;
  return Math.min(1, baseRate + pityBonus);
}

/**
 * COST - 강화/업그레이드 비용 (SCALE을 정수로)
 */
export function COST(
  baseCost: number,
  level: number,
  rate: number = 1.5,
  curveType: string = 'exponential'
): number {
  return Math.floor(SCALE(baseCost, level, rate, curveType));
}

/**
 * WAVE_POWER - 웨이브/스테이지 적 파워
 */
export function WAVE_POWER(basePower: number, wave: number, rate: number = 1.1): number {
  return basePower * Math.pow(rate, wave - 1);
}

/**
 * DIMINISHING - 체감 수익 (softcap 이후 한계 수익 체감)
 */
export function DIMINISHING(
  base: number,
  input: number,
  softcap: number,
  hardcap: number = Infinity
): number {
  if (input <= softcap) return base + input;

  const overCap = input - softcap;
  const diminished = softcap + overCap * (1 - overCap / (overCap + softcap));
  const result = base + diminished;

  return hardcap === Infinity ? result : Math.min(result, hardcap);
}

/**
 * ELEMENT_MULT - 속성 상성 (가위바위보 스타일)
 */
export function ELEMENT_MULT(
  attackElement: number,
  defenseElement: number,
  strong: number = 1.5,
  weak: number = 0.5
): number {
  const diff = ((attackElement - defenseElement) % 3 + 3) % 3;
  if (diff === 1) return strong;
  if (diff === 2) return weak;
  return 1;
}

/**
 * STAMINA_REGEN - 스태미나/에너지 재생량
 */
export function STAMINA_REGEN(maxStamina: number, regenTime: number, elapsed: number): number {
  const regenPerMinute = maxStamina / regenTime;
  return Math.min(maxStamina, regenPerMinute * elapsed);
}

/**
 * COMBO_MULT - 콤보 배율
 */
export function COMBO_MULT(
  comboCount: number,
  baseMultiplier: number = 1,
  perComboBonus: number = 0.1,
  maxBonus: number = 2.0
): number {
  const bonus = Math.min(comboCount * perComboBonus, maxBonus);
  return baseMultiplier + bonus;
}

/**
 * STAR_RATING - 별점 (0.5 단위)
 */
export function STAR_RATING(value: number, maxValue: number, maxStars: number = 5): number {
  if (maxValue <= 0) return 0;
  return Math.round((value / maxValue) * maxStars * 2) / 2;
}

/**
 * TIER_INDEX - 값을 티어 인덱스로 변환
 */
export function TIER_INDEX(value: number, ...thresholds: number[]): number {
  for (let i = thresholds.length - 1; i >= 0; i--) {
    if (value >= thresholds[i]) return i + 1;
  }
  return 0;
}
