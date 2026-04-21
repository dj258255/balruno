/**
 * FPS 팀 전투 시뮬 — 3v3 / 5v5 — Valorant / CS2 / Apex Legends 방식.
 *
 * 핵심 지표:
 *  - Team win rate
 *  - Trade-kill 분석: A-player1 이 B-player2 를 잡는 사이 B-team 이 A-player1 을 잡는 비율
 *  - Average round duration
 *  - First blood 점유율
 *  - Clutch rate (1 vs N 역전)
 */

import {
  type WeaponStats,
  type PlayerStats,
  type AimProfile,
  rangeMultiplier,
} from './fpsSimulation';

export interface FpsTeamPlayer {
  id: string;
  name: string;
  weapon: WeaponStats;
  player: PlayerStats;
  aim: AimProfile;
  /** 이 플레이어가 타겟팅할 적 ID. 없으면 random 선택 */
  preferredTargetId?: string;
}

export interface FpsTeamEngagement {
  distance: number;
  /** 교전 시작 시점의 지연 시간 — 첫 발 우위 없이 동시 조우 기준 */
  startDelayMs: number;
}

export interface FpsTeamSimResult {
  teamAWinRate: number;
  teamBWinRate: number;
  avgDurationMs: number;
  /** 첫 킬 점유율 — 팀 기준 */
  firstBloodA: number;
  firstBloodB: number;
  /** Trade-kill 비율 (0-1): 첫 사망자 발생 후 N 초 이내 같은 팀이 복수함 */
  tradeKillRate: number;
  /** Clutch 승리 (1 vs N 에서 이긴 횟수) */
  clutchWinsA: number;
  clutchWinsB: number;
  /** 평균 생존자 수 (승리 팀) */
  avgSurvivorsWinner: number;
  /** 개별 플레이어 통계: k/d */
  playerStats: Record<string, { kills: number; deaths: number; damage: number }>;
}

// ============================================================================
// 교전 내부 상태
// ============================================================================

interface ActivePlayer {
  ref: FpsTeamPlayer;
  team: 'A' | 'B';
  hp: number;
  alive: boolean;
  shotsInMag: number;
  nextShotMs: number;
  killedAtMs?: number;
  killerId?: string;
  kills: number;
  damage: number;
}

function pickTarget(shooter: ActivePlayer, enemies: ActivePlayer[]): ActivePlayer | null {
  const alive = enemies.filter((e) => e.alive);
  if (alive.length === 0) return null;
  if (shooter.ref.preferredTargetId) {
    const pref = alive.find((e) => e.ref.id === shooter.ref.preferredTargetId);
    if (pref) return pref;
  }
  // 가장 낮은 HP 타겟 (Valorant AI 의 focus-fire 기본)
  return alive.reduce((low, cur) => (cur.hp < low.hp ? cur : low));
}

function rollTeamShot(
  shooter: ActivePlayer,
  target: ActivePlayer,
  distance: number,
): { damage: number; hit: boolean } {
  const { weapon, aim } = shooter.ref;
  if (Math.random() > aim.hitRate) return { damage: 0, hit: false };

  // 부위 판정 (head/body/limb)
  const r = Math.random();
  let baseDmg: number;
  if (r < aim.headshotRate) baseDmg = weapon.damageHead;
  else if (r < aim.headshotRate + aim.bodyRate) baseDmg = weapon.damageBody;
  else baseDmg = weapon.damageLimb;

  const rangeMul = rangeMultiplier(weapon, distance);
  const effArmor = target.ref.player.armor * (1 - weapon.armorPenPercent);
  const armorMul = Math.max(0, 1 - effArmor);
  return { damage: baseDmg * rangeMul * armorMul, hit: true };
}

// ============================================================================
// 한 라운드 시뮬 (A vs B 동시)
// ============================================================================

function simulateRound(
  teamA: FpsTeamPlayer[],
  teamB: FpsTeamPlayer[],
  engagement: FpsTeamEngagement,
): {
  winner: 'A' | 'B' | 'draw';
  durationMs: number;
  firstKill: { team: 'A' | 'B'; atMs: number } | null;
  killEvents: { killerTeam: 'A' | 'B'; victimId: string; atMs: number }[];
  survivors: number;
  playerFinalStats: Map<string, { kills: number; deaths: number; damage: number }>;
} {
  const makeActive = (p: FpsTeamPlayer, team: 'A' | 'B'): ActivePlayer => ({
    ref: p,
    team,
    hp: p.player.hp + p.player.shield,
    alive: true,
    shotsInMag: 0,
    nextShotMs: engagement.startDelayMs + p.aim.reactionMs,
    kills: 0,
    damage: 0,
  });
  const aList = teamA.map((p) => makeActive(p, 'A'));
  const bList = teamB.map((p) => makeActive(p, 'B'));

  const killEvents: { killerTeam: 'A' | 'B'; victimId: string; atMs: number }[] = [];
  let firstKill: { team: 'A' | 'B'; atMs: number } | null = null;
  let time = 0;
  const MAX_TIME = 30_000; // 30s 안에 끝남

  while (time < MAX_TIME) {
    const alive = [...aList, ...bList].filter((p) => p.alive);
    // 둘 중 한 팀 모두 사망 → 종료
    const aliveA = alive.filter((p) => p.team === 'A').length;
    const aliveB = alive.filter((p) => p.team === 'B').length;
    if (aliveA === 0 || aliveB === 0) break;

    // 다음 발사 이벤트 찾기
    const candidates = alive.filter((p) => p.shotsInMag < p.ref.weapon.magazineSize);
    if (candidates.length === 0) break;
    const shooter = candidates.reduce((min, cur) => (cur.nextShotMs < min.nextShotMs ? cur : min));
    time = shooter.nextShotMs;

    const enemies = shooter.team === 'A' ? bList : aList;
    const target = pickTarget(shooter, enemies);
    if (!target) break;

    const { damage } = rollTeamShot(shooter, target, engagement.distance);
    shooter.damage += damage;
    target.hp -= damage;
    shooter.shotsInMag++;
    shooter.nextShotMs += 60_000 / shooter.ref.weapon.rpm;
    if (shooter.shotsInMag >= shooter.ref.weapon.magazineSize) {
      shooter.nextShotMs += shooter.ref.weapon.reloadTimeSeconds * 1000;
      shooter.shotsInMag = 0;
    }

    if (target.hp <= 0 && target.alive) {
      target.alive = false;
      target.killedAtMs = time;
      target.killerId = shooter.ref.id;
      shooter.kills++;
      const evt = { killerTeam: shooter.team, victimId: target.ref.id, atMs: time };
      killEvents.push(evt);
      if (!firstKill) firstKill = { team: shooter.team, atMs: time };
    }
  }

  const aliveFinal = [...aList, ...bList].filter((p) => p.alive);
  const aSurvivors = aliveFinal.filter((p) => p.team === 'A').length;
  const bSurvivors = aliveFinal.filter((p) => p.team === 'B').length;
  const winner: 'A' | 'B' | 'draw' =
    aSurvivors > 0 && bSurvivors === 0 ? 'A' :
    bSurvivors > 0 && aSurvivors === 0 ? 'B' :
    'draw';

  const playerFinalStats = new Map<string, { kills: number; deaths: number; damage: number }>();
  for (const p of [...aList, ...bList]) {
    playerFinalStats.set(p.ref.id, {
      kills: p.kills,
      deaths: p.alive ? 0 : 1,
      damage: p.damage,
    });
  }

  return {
    winner,
    durationMs: time,
    firstKill,
    killEvents,
    survivors: winner === 'A' ? aSurvivors : winner === 'B' ? bSurvivors : 0,
    playerFinalStats,
  };
}

// ============================================================================
// Monte Carlo 팀 시뮬
// ============================================================================

export function simulateFpsTeamBattle(
  teamA: FpsTeamPlayer[],
  teamB: FpsTeamPlayer[],
  engagement: FpsTeamEngagement,
  runs = 2000,
): FpsTeamSimResult {
  let aWins = 0;
  let bWins = 0;
  let durationSum = 0;
  let firstBloodACount = 0;
  let firstBloodBCount = 0;
  let tradeKillCount = 0;
  let clutchA = 0;
  let clutchB = 0;
  let survivorSum = 0;
  let survivorRuns = 0;

  const TRADE_WINDOW_MS = 3000; // 3초 이내 복수 → trade kill

  const allPlayerIds = [...teamA, ...teamB].map((p) => p.id);
  const playerStatsAgg: Record<string, { kills: number; deaths: number; damage: number }> =
    Object.fromEntries(allPlayerIds.map((id) => [id, { kills: 0, deaths: 0, damage: 0 }]));

  for (let i = 0; i < runs; i++) {
    const r = simulateRound(teamA, teamB, engagement);
    if (r.winner === 'A') aWins++;
    else if (r.winner === 'B') bWins++;
    durationSum += r.durationMs;

    if (r.firstKill?.team === 'A') firstBloodACount++;
    else if (r.firstKill?.team === 'B') firstBloodBCount++;

    // Trade kill: 첫 사망 후 N초 내 같은 팀이 상대 팀원 처치
    if (r.killEvents.length >= 2) {
      const first = r.killEvents[0];
      const retaliation = r.killEvents.find(
        (e) => e.killerTeam !== first.killerTeam && e.atMs - first.atMs < TRADE_WINDOW_MS && e.atMs > first.atMs,
      );
      if (retaliation) tradeKillCount++;
    }

    // Clutch: 한 팀이 1명 남았는데 역전해 이긴 경우
    // 승리 팀의 생존자 수가 1명 + 패배 팀 시작 인원 > 1
    if (r.survivors === 1) {
      if (r.winner === 'A' && teamB.length > 1) clutchA++;
      if (r.winner === 'B' && teamA.length > 1) clutchB++;
    }

    if (r.winner !== 'draw') {
      survivorSum += r.survivors;
      survivorRuns++;
    }

    r.playerFinalStats.forEach((s, id) => {
      const agg = playerStatsAgg[id];
      if (agg) {
        agg.kills += s.kills;
        agg.deaths += s.deaths;
        agg.damage += s.damage;
      }
    });
  }

  // Normalize playerStats to per-run avg
  for (const id of allPlayerIds) {
    playerStatsAgg[id].kills /= runs;
    playerStatsAgg[id].deaths /= runs;
    playerStatsAgg[id].damage /= runs;
  }

  return {
    teamAWinRate: aWins / runs,
    teamBWinRate: bWins / runs,
    avgDurationMs: durationSum / runs,
    firstBloodA: firstBloodACount / runs,
    firstBloodB: firstBloodBCount / runs,
    tradeKillRate: tradeKillCount / runs,
    clutchWinsA: clutchA,
    clutchWinsB: clutchB,
    avgSurvivorsWinner: survivorRuns > 0 ? survivorSum / survivorRuns : 0,
    playerStats: playerStatsAgg,
  };
}
