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
  // 공격이 끝난 뒤 남은 프레임 (recovery) 이 hitstun 보다 짧으면 유리
  // 상대 hitstun 이 N → N - recovery 가 유리 프레임
  const onHit = move.hitstun - move.recovery;
  const onBlock = move.blockstun - move.recovery;
  return {
    move,
    total,
    onHit,
    onBlock,
    punishableOnBlock: onBlock <= -5,
    advantageHit: advantageTier(onHit),
    advantageBlock: advantageTier(onBlock),
  };
}

// ============================================================================
// 콤보 연결 검증 (hitstun ≥ next.startup 이면 연결됨)
// ============================================================================

export function checkComboLink(from: FrameData, to: FrameData): ComboLink {
  // 맞춘 후: from.recovery 프레임이 지나야 다음 입력 가능 → 하지만 cancel 은 여기서 단순화
  // hitstun 에서 남은 프레임 = from.hitstun - from.recovery
  const remaining = from.hitstun - from.recovery;
  const frameGap = remaining - to.startup;
  return {
    from,
    to,
    connects: frameGap >= 0,
    frameGap,
    totalDamage: from.damage + to.damage,
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
  { id: 'shoryuken', name: '승룡권', category: 'special', startup: 3, active: 14, recovery: 35, hitstun: 30, blockstun: 20, damage: 120 },
  // Super
  { id: 'super', name: '수퍼', category: 'super', startup: 7, active: 6, recovery: 40, hitstun: 40, blockstun: 25, damage: 350 },
];
