/**
 * Bisection root-finder — Excel Goal Seek 패턴의 경량 구현.
 *
 * 주어진 f(x) = target 을 만족하는 x 를 [lo, hi] 범위에서 찾음.
 *  - f 는 monotone 가정 (증가 or 감소)
 *  - tolerance 이내면 해 반환
 *  - 최대 iter 내 수렴 실패 시 null
 *
 * 용도:
 *  - Calculator 의 "목표 DPS → 필요 ATK" 역산
 *  - Calculator 의 "목표 EHP → 필요 DEF" 역산
 *  - 단변수 monotone 함수만 지원 (crit rate 등 복잡한 건 별도)
 */

export interface BisectionOptions {
  /** 검색 하한 (default 0) */
  lo?: number;
  /** 검색 상한 — 파라미터 성격에 맞게 지정 (default 10000) */
  hi?: number;
  /** 허용 오차 (default 0.01) */
  tolerance?: number;
  /** 최대 반복 (default 50) */
  maxIter?: number;
}

export interface BisectionResult {
  x: number;
  /** f(x) 실제 값 */
  y: number;
  /** 목표와의 오차 |y - target| */
  error: number;
  /** 수렴 여부 */
  converged: boolean;
  /** 사용한 반복 수 */
  iterations: number;
}

/**
 * f(x) = target 을 만족하는 x 찾기.
 * f 가 monotone 증가 or 감소 둘 다 자동 판별.
 */
export function bisect(
  f: (x: number) => number,
  target: number,
  opts: BisectionOptions = {},
): BisectionResult | null {
  const { lo = 0, hi = 10000, tolerance = 0.01, maxIter = 50 } = opts;

  const fLo = f(lo);
  const fHi = f(hi);

  // monotone 증가/감소 판별
  const increasing = fHi > fLo;

  // 범위 밖이면 null
  if (increasing) {
    if (target < fLo || target > fHi) return null;
  } else {
    if (target > fLo || target < fHi) return null;
  }

  let left = lo;
  let right = hi;
  let iter = 0;
  let mid = (left + right) / 2;
  let fMid = f(mid);

  for (; iter < maxIter; iter++) {
    mid = (left + right) / 2;
    fMid = f(mid);

    if (Math.abs(fMid - target) <= tolerance) break;
    // x 간격이 매우 좁아지면 수치 한계 — 루프 종료하되 y tolerance 재평가
    if (right - left < 1e-10) break;

    if ((increasing && fMid < target) || (!increasing && fMid > target)) {
      left = mid;
    } else {
      right = mid;
    }
  }

  const error = Math.abs(fMid - target);
  return {
    x: mid,
    y: fMid,
    error,
    converged: error <= tolerance,
    iterations: iter,
  };
}
