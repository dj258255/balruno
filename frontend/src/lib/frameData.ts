/**
 * 격투 게임 프레임 데이터 분석 — Street Fighter / Tekken / Guilty Gear 계열.
 *
 * 핵심 개념:
 *  - Startup:  발동 전 프레임 (빠를수록 좋음)
 *  - Active:   공격 판정 유지 프레임
 *  - Recovery: 공격 후 경직 프레임
 *  - OnHit:    상대에게 맞았을 때 유리/불리 프레임 (+/-)
 *  - OnBlock:  상대가 가드했을 때 유리/불리 프레임
 *  - Total = Startup + Active + Recovery
 *  - Hitstun: 피격 경직 — onHit 계산 기준
 *  - Blockstun: 가드 경직 — onBlock 계산 기준
 *
 * 60 FPS 기준. 한 프레임 = 16.67ms
 */

export interface FrameData {
  id: string;
  name: string;
  startup: number;
  active: number;
  recovery: number;
  /** 상대가 맞을 때 hitstun 프레임 */
  hitstun: number;
  /** 상대가 가드할 때 blockstun 프레임 */
  blockstun: number;
  /** 피해 */
  damage: number;
  /** 필살기 분류 (light/medium/heavy/special/super) */
  category?: 'light' | 'medium' | 'heavy' | 'special' | 'super';
  /**
   * 무적 프레임 — 기술 시작부터 N 프레임 동안 피격 불가 (invulnerable).
   * Street Fighter 승룡권 1-6f, DP 공통 패턴.
   * 예: 승룡권 = 6 → startup 1-6f 까지 무적
   */
  invincibleFrames?: number;
  /** 무적 타입 — strike(타격)/throw(잡기)/full(둘 다) */
  invincibleType?: 'strike' | 'throw' | 'full';
  /**
   * 카운터-히트 피해 배율 — 상대 공격 startup 중에 맞췄을 때.
   * SF6 표준: 1.2x (일반), 카운터 전용 기술은 1.5~2.0x.
   * 기본 1.2 (없으면).
   */
  counterHitMultiplier?: number;
  /** 카운터 히트 시 추가 hitstun (+프레임) — 콤보 라우트 확장에 쓰임 */
  counterHitExtraHitstun?: number;
}

export interface MoveAnalysis {
  move: FrameData;
  total: number;
  onHit: number;      // + 유리 / - 불리 프레임
  onBlock: number;
  /** 펀시 가능 여부 (블록 시 상대가 punish 가능한가) */
  punishableOnBlock: boolean;
  /** 유리 프레임 tier */
  advantageHit: 'heavily-plus' | 'plus' | 'neutral' | 'minus' | 'heavily-minus';
  advantageBlock: 'heavily-plus' | 'plus' | 'neutral' | 'minus' | 'heavily-minus';
  /** 카운터 히트 시 피해 (counterHitMultiplier 반영) */
  counterHitDamage: number;
  /** 카운터 히트 시 onHit 프레임 (확장 hitstun 반영) */
  counterHitOnHit: number;
  /** 무적 구간 프레임 범위 (startup 1부터 N까지). 없으면 null */
  invincibleRange: { from: number; to: number; type: 'strike' | 'throw' | 'full' } | null;
}

export interface ComboLink {
  /** 연결 전 기술 */
  from: FrameData;
  /** 다음 기술 */
  to: FrameData;
  /** 연결 가능 여부 (hitstun ≥ next.startup) */
  connects: boolean;
  /** 프레임 여유 — 양수면 연결, 음수면 불가 */
  frameGap: number;
  /** 총 피해 */
  totalDamage: number;
}

export interface ComboRoute {
  moves: FrameData[];
  links: ComboLink[];
  totalDamage: number;
  /** 전체 연결 가능한가 */
  feasible: boolean;
  /** 총 프레임 지속 시간 */
  totalFrames: number;
}

// ============================================================================
// 단일 기술 분석
// ============================================================================

function advantageTier(
  frames: number,
): 'heavily-plus' | 'plus' | 'neutral' | 'minus' | 'heavily-minus' {
  if (frames >= 5) return 'heavily-plus';
  if (frames >= 1) return 'plus';
  if (frames >= -2) return 'neutral';
  if (frames >= -7) return 'minus';
  return 'heavily-minus';
}

export function analyzeMove(move: FrameData): MoveAnalysis {
  const total = move.startup + move.active + move.recovery;
  const onHit = move.hitstun - move.recovery;
  const onBlock = move.blockstun - move.recovery;

  const chMul = move.counterHitMultiplier ?? 1.2;
  const chExtra = move.counterHitExtraHitstun ?? 2;
  const counterHitDamage = Math.round(move.damage * chMul);
  const counterHitOnHit = onHit + chExtra;

  const invincibleRange = move.invincibleFrames
    ? {
        from: 1,
        to: move.invincibleFrames,
        type: move.invincibleType ?? 'full',
      }
    : null;

  return {
    move,
    total,
    onHit,
    onBlock,
    punishableOnBlock: onBlock <= -5,
    advantageHit: advantageTier(onHit),
    advantageBlock: advantageTier(onBlock),
    counterHitDamage,
    counterHitOnHit,
    invincibleRange,
  };
}

// ============================================================================
// 콤보 연결 검증 (hitstun ≥ next.startup 이면 연결됨)
// ============================================================================

export function checkComboLink(from: FrameData, to: FrameData, counterHit = false): ComboLink {
  const chExtra = counterHit ? (from.counterHitExtraHitstun ?? 2) : 0;
  const remaining = from.hitstun + chExtra - from.recovery;
  const frameGap = remaining - to.startup;
  const fromDamage = counterHit ? Math.round(from.damage * (from.counterHitMultiplier ?? 1.2)) : from.damage;
  return {
    from,
    to,
    connects: frameGap >= 0,
    frameGap,
    totalDamage: fromDamage + to.damage,
  };
}

export function analyzeComboRoute(moves: FrameData[]): ComboRoute {
  const links: ComboLink[] = [];
  let totalDamage = 0;
  let allConnect = true;
  let totalFrames = 0;

  for (let i = 0; i < moves.length; i++) {
    totalDamage += moves[i].damage;
    totalFrames += moves[i].startup + moves[i].active + moves[i].recovery;
    if (i < moves.length - 1) {
      const link = checkComboLink(moves[i], moves[i + 1]);
      links.push(link);
      if (!link.connects) allConnect = false;
    }
  }

  return {
    moves,
    links,
    totalDamage,
    feasible: allConnect,
    totalFrames,
  };
}

// ============================================================================
// 기본 move 프리셋 (Street Fighter 6 Ryu 기반 근사치)
// ============================================================================

export const MOVE_PRESETS: FrameData[] = [
  // Light
  { id: 'lp', name: '약 P', category: 'light', startup: 4, active: 3, recovery: 7, hitstun: 12, blockstun: 10, damage: 30 },
  { id: 'lk', name: '약 K', category: 'light', startup: 5, active: 3, recovery: 9, hitstun: 12, blockstun: 10, damage: 30 },
  // Medium
  { id: 'mp', name: '중 P', category: 'medium', startup: 6, active: 3, recovery: 14, hitstun: 17, blockstun: 13, damage: 60 },
  { id: 'mk', name: '중 K', category: 'medium', startup: 7, active: 4, recovery: 16, hitstun: 17, blockstun: 13, damage: 70 },
  // Heavy
  { id: 'hp', name: '강 P', category: 'heavy', startup: 9, active: 4, recovery: 20, hitstun: 22, blockstun: 16, damage: 90 },
  { id: 'hk', name: '강 K', category: 'heavy', startup: 11, active: 5, recovery: 23, hitstun: 22, blockstun: 16, damage: 100 },
  // Special
  { id: 'hadouken', name: '파동권', category: 'special', startup: 13, active: 2, recovery: 35, hitstun: 20, blockstun: 15, damage: 60 },
  // 승룡권: SF6 기준 startup 3, 1-6f 무적 (공식 프레임 데이터)
  { id: 'shoryuken', name: '승룡권', category: 'special', startup: 3, active: 14, recovery: 35, hitstun: 30, blockstun: 20, damage: 120, invincibleFrames: 6, invincibleType: 'full', counterHitMultiplier: 1.2 },
  // Super: 일반적 1-10f 무적 + CH 1.5x
  { id: 'super', name: '수퍼', category: 'super', startup: 7, active: 6, recovery: 40, hitstun: 40, blockstun: 25, damage: 350, invincibleFrames: 10, invincibleType: 'full', counterHitMultiplier: 1.5 },
];
