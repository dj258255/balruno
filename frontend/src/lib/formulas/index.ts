/**
 * 수식 함수 공개 API + mathjs 등록용 번들.
 *
 * formulaEngine은 여기서 `formulaBundle` 을 import 해 `math.import()` 에 넘긴다.
 * 외부 컴포넌트는 개별 함수를 이름으로 import (e.g. `import { SCALE } from '@/lib/formulas'`).
 */

import {
  SCALE, DAMAGE, DPS, TTK, EHP, DROP_RATE, GACHA_PITY, COST, WAVE_POWER,
  DIMINISHING, ELEMENT_MULT, STAMINA_REGEN, COMBO_MULT, STAR_RATING, TIER_INDEX,
} from './game';

import {
  CLAMP, LERP, INVERSE_LERP, REMAP,
  POWER, ABS, ROUND, FLOOR, CEIL, SQRT, LOG, LOG10, LOG2, EXP, MOD, SIGN, TRUNC,
  SIN, COS, TAN, ASIN, ACOS, ATAN, ATAN2, DEGREES, RADIANS,
  PI, E,
} from './math';

import {
  SUM, AVERAGE, MIN, MAX, COUNT, MEDIAN, STDEV, VARIANCE,
} from './stats';

import {
  CHANCE, EXPECTED_ATTEMPTS, COMPOUND, RAND, RANDBETWEEN,
} from './prob';

import {
  IF, AND, OR, NOT,
} from './logic';

// 외부 재사용을 위한 named re-exports (기존 formulaEngine 공개 API 유지)
export {
  // 게임
  SCALE, DAMAGE, DPS, TTK, EHP, DROP_RATE, GACHA_PITY, COST, WAVE_POWER,
  DIMINISHING, ELEMENT_MULT, STAMINA_REGEN, COMBO_MULT, STAR_RATING, TIER_INDEX,
  // 수학
  CLAMP, LERP, INVERSE_LERP, REMAP,
  POWER, ABS, ROUND, FLOOR, CEIL, SQRT, LOG, LOG10, LOG2, EXP, MOD, SIGN, TRUNC,
  SIN, COS, TAN, ASIN, ACOS, ATAN, ATAN2, DEGREES, RADIANS,
  PI, E,
  // 통계
  SUM, AVERAGE, MIN, MAX, COUNT, MEDIAN, STDEV, VARIANCE,
  // 확률/랜덤
  CHANCE, EXPECTED_ATTEMPTS, COMPOUND, RAND, RANDBETWEEN,
  // 논리
  IF, AND, OR, NOT,
};

/**
 * mathjs.import() 에 넘길 번들.
 * 키 이름 = 수식에서 호출할 함수명.
 */
export const formulaBundle = {
  // 게임 밸런스
  SCALE, DAMAGE, DPS, TTK, EHP, DROP_RATE, GACHA_PITY, COST, WAVE_POWER,
  // 유틸리티
  CLAMP, LERP, INVERSE_LERP, REMAP, CHANCE, EXPECTED_ATTEMPTS, COMPOUND,
  DIMINISHING, ELEMENT_MULT, STAMINA_REGEN, COMBO_MULT, STAR_RATING, TIER_INDEX,
  // 엑셀 호환 수학
  POWER, ABS, ROUND, FLOOR, CEIL, SQRT, LOG, LOG10, LOG2, EXP, MOD, SIGN, TRUNC,
  // 통계
  SUM, AVERAGE, MIN, MAX, COUNT, MEDIAN, STDEV, VARIANCE,
  // 삼각함수
  SIN, COS, TAN, ASIN, ACOS, ATAN, ATAN2, DEGREES, RADIANS,
  // 조건/논리
  IF, AND, OR, NOT,
  // 랜덤
  RAND, RANDBETWEEN,
  // 상수
  PI, E,
};
