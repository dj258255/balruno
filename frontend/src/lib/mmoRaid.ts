/**
 * MMORPG Raid DPS Race — WoW / FFXIV / Lost Ark 레이드 밸런싱.
 *
 * 핵심 지표:
 *  - Enrage timer: 보스 분노 전까지 DPS race (하드 벽)
 *  - Role 구성: Tank / Healer / DPS (3/1~2/6~7 표준)
 *  - 보스 페이즈: HP% 전환 → 메카닉 변경
 *  - 힐 throughput vs 데미지 incoming — 팀 생존
 *  - DPS rotation uptime: 쿨기 정렬 시 피크 vs 평균
 *
 * 모델:
 *  - 파티원: role, HPS/DPS, hp, mitigation
 *  - 보스: totalHp, enrageAtSec, DamagePerSec (raid-wide), 각 페이즈별 계수
 *  - 페이즈 전환: HP% threshold, 추가 debuff/damage
 *  - 결과: wipe or kill + timestamp
 */

export type RaiderRole = 'tank' | 'healer' | 'dps';

export interface Raider {
  id: string;
  name: string;
  role: RaiderRole;
  hp: number;
  /** DPS 또는 HPS (role 따라) */
  output: number;
  /** 버스트 배율 — 쿨기 발동 시 output × burstMul */
  burstMul: number;
  /** 버스트 지속 시간 (초) */
  burstDurationSec: number;
  /** 버스트 쿨다운 (초) */
  burstCooldownSec: number;
  /** 받는 피해 감소 비율 (탱커 = 0.5, 힐러 = 0.1, DPS = 0.05) */
  mitigation: number;
}

export interface RaidBossPhase {
  /** 이 페이즈가 시작되는 HP% (예: phase 2 = 0.6 = 60%에서 시작) */
  startAtHpPct: number;
  /** 이 페이즈 동안 보스의 raid-wide DPS */
  raidWideDps: number;
  /** 이 페이즈 동안 탱커에게 가는 단일 DPS (tank buster) */
  tankDps: number;
  /** 페이즈 이름 (UI) */
  label: string;
  /** 분노 (enrage) 페이즈 여부 — true 면 추가 damage ramp-up */
  isEnrage?: boolean;
}

export interface RaidBoss {
  id: string;
  name: string;
  totalHp: number;
  /** Enrage 발동 시간 (초). 이 시간 지나면 모든 페이즈에 +50% dmg 추가 */
  enrageAtSec: number;
  phases: RaidBossPhase[];
}

export interface RaidSimConfig {
  raiders: Raider[];
  boss: RaidBoss;
  /** 시뮬 최대 시간 (초) */
  maxDurationSec: number;
}

export interface RaidSimResult {
  /** 'kill' / 'wipe' / 'enrage' */
  outcome: 'kill' | 'wipe' | 'enrage';
  /** 전투 지속 시간 (초) */
  durationSec: number;
  /** 최종 보스 HP % (kill 이면 0) */
  bossHpPct: number;
  /** 공대 dps (average) */
  averageRaidDps: number;
  /** 공대 hps (average, 힐러) */
  averageRaidHps: number;
  /** 생존자 수 (공대 전체 8 기준) */
  survivors: number;
  /** 각 페이즈 진입 시각 (sec). -1 = 미도달 */
  phaseEnterTimes: number[];
  /** 사망 타임라인 */
  deaths: Array<{ raiderId: string; timeSec: number }>;
  /** DPS 요구치 대 실제 (kill 위해 필요했던 avg DPS) */
  requiredDpsForKill: number;
}

// ============================================================================
// 시뮬 — 1초 tick
// ============================================================================

export function simulateRaid(cfg: RaidSimConfig): RaidSimResult {
  // 공대원 상태 초기화
  const raiders = cfg.raiders.map((r) => ({
    ...r,
    currentHp: r.hp,
    alive: true,
    burstCooldownRemaining: 0,
    burstDurationRemaining: 0,
    burstActivations: 0,
  }));

  let bossHp = cfg.boss.totalHp;
  let totalDamage = 0;
  let totalHealing = 0;
  const deaths: RaidSimResult['deaths'] = [];
  const phaseEnterTimes = cfg.boss.phases.map(() => -1);
  let phaseIdx = 0;
  phaseEnterTimes[0] = 0;

  const tick = 1;
  let outcome: 'kill' | 'wipe' | 'enrage' = 'enrage';

  for (let t = 0; t <= cfg.maxDurationSec; t += tick) {
    // 현재 페이즈 판정 — HP % 낮아지면 전환
    const bossHpPct = bossHp / cfg.boss.totalHp;
    for (let p = phaseIdx + 1; p < cfg.boss.phases.length; p++) {
      if (bossHpPct <= cfg.boss.phases[p].startAtHpPct) {
        phaseIdx = p;
        phaseEnterTimes[p] = t;
      }
    }
    const phase = cfg.boss.phases[phaseIdx];

    // Enrage 추가 피해 ramp
    const enrageMul = t > cfg.boss.enrageAtSec ? 1 + (t - cfg.boss.enrageAtSec) * 0.05 : 1;

    // 공대원 액션: DPS 는 보스 딜, 힐러는 공대 힐, 탱커는 보조 딜
    let tickDamage = 0;
    let tickHealing = 0;

    for (const r of raiders) {
      if (!r.alive) continue;

      // 버스트 처리
      if (r.burstCooldownRemaining > 0) r.burstCooldownRemaining -= tick;
      if (r.burstDurationRemaining > 0) r.burstDurationRemaining -= tick;
      if (r.burstCooldownRemaining <= 0 && r.burstDurationRemaining <= 0 && r.burstActivations < 5) {
        r.burstDurationRemaining = r.burstDurationSec;
        r.burstCooldownRemaining = r.burstCooldownSec;
        r.burstActivations++;
      }
      const outputMul = r.burstDurationRemaining > 0 ? r.burstMul : 1;

      if (r.role === 'dps' || r.role === 'tank') {
        const dmg = r.output * outputMul * (r.role === 'tank' ? 0.4 : 1);
        tickDamage += dmg;
      } else if (r.role === 'healer') {
        tickHealing += r.output * outputMul;
      }
    }

    totalDamage += tickDamage;
    totalHealing += tickHealing;
    bossHp -= tickDamage;

    if (bossHp <= 0) {
      outcome = 'kill';
      totalDamage = cfg.boss.totalHp;
      for (let i = 0; i < raiders.length; i++) {
        if (!raiders[i].alive) { /* already counted in deaths */ }
      }
      return {
        outcome,
        durationSec: t,
        bossHpPct: 0,
        averageRaidDps: totalDamage / Math.max(1, t),
        averageRaidHps: totalHealing / Math.max(1, t),
        survivors: raiders.filter((r) => r.alive).length,
        phaseEnterTimes,
        deaths,
        requiredDpsForKill: cfg.boss.totalHp / Math.max(1, t),
      };
    }

    // 보스 → 공대원 피해
    const aliveDps = raiders.filter((r) => r.alive && r.role !== 'tank');
    const aliveTanks = raiders.filter((r) => r.alive && r.role === 'tank');

    const raidDmgPerMember = aliveDps.length > 0 ? (phase.raidWideDps * enrageMul) / aliveDps.length : 0;
    for (const r of aliveDps) {
      const mitigatedDmg = raidDmgPerMember * (1 - r.mitigation);
      r.currentHp -= mitigatedDmg;
      // 힐 분배 (단순: 균등)
      const healShare = aliveDps.length > 0 ? tickHealing / aliveDps.length : 0;
      r.currentHp = Math.min(r.hp, r.currentHp + healShare);
      if (r.currentHp <= 0) {
        r.alive = false;
        deaths.push({ raiderId: r.id, timeSec: t });
      }
    }

    // Tank buster
    if (aliveTanks.length > 0) {
      const tankDmg = (phase.tankDps * enrageMul) / aliveTanks.length;
      for (const tank of aliveTanks) {
        const mitigated = tankDmg * (1 - tank.mitigation);
        tank.currentHp -= mitigated;
        // 탱커는 힐러가 집중 (힐 전체의 40%)
        tank.currentHp = Math.min(tank.hp, tank.currentHp + tickHealing * 0.4 / aliveTanks.length);
        if (tank.currentHp <= 0) {
          tank.alive = false;
          deaths.push({ raiderId: tank.id, timeSec: t });
        }
      }
    }

    // 공대 전멸 체크
    if (raiders.every((r) => !r.alive)) {
      outcome = 'wipe';
      return {
        outcome,
        durationSec: t,
        bossHpPct: bossHp / cfg.boss.totalHp,
        averageRaidDps: totalDamage / Math.max(1, t),
        averageRaidHps: totalHealing / Math.max(1, t),
        survivors: 0,
        phaseEnterTimes,
        deaths,
        requiredDpsForKill: bossHp / Math.max(1, cfg.boss.enrageAtSec - t),
      };
    }
  }

  // enrage (시간 초과)
  return {
    outcome: 'enrage',
    durationSec: cfg.maxDurationSec,
    bossHpPct: bossHp / cfg.boss.totalHp,
    averageRaidDps: totalDamage / cfg.maxDurationSec,
    averageRaidHps: totalHealing / cfg.maxDurationSec,
    survivors: raiders.filter((r) => r.alive).length,
    phaseEnterTimes,
    deaths,
    requiredDpsForKill: cfg.boss.totalHp / cfg.boss.enrageAtSec,
  };
}

// ============================================================================
// 프리셋 — WoW 스타일 8인 파티
// ============================================================================

export function defaultRaidParty(): Raider[] {
  return [
    { id: 't1', name: '탱커', role: 'tank', hp: 80000, output: 4000, burstMul: 1.5, burstDurationSec: 15, burstCooldownSec: 120, mitigation: 0.5 },
    { id: 'h1', name: '힐러 1', role: 'healer', hp: 40000, output: 6000, burstMul: 2.0, burstDurationSec: 10, burstCooldownSec: 180, mitigation: 0.15 },
    { id: 'h2', name: '힐러 2', role: 'healer', hp: 40000, output: 6000, burstMul: 2.0, burstDurationSec: 10, burstCooldownSec: 180, mitigation: 0.15 },
    { id: 'd1', name: 'DPS 1', role: 'dps', hp: 45000, output: 10000, burstMul: 1.8, burstDurationSec: 20, burstCooldownSec: 120, mitigation: 0.08 },
    { id: 'd2', name: 'DPS 2', role: 'dps', hp: 45000, output: 10000, burstMul: 1.8, burstDurationSec: 20, burstCooldownSec: 120, mitigation: 0.08 },
    { id: 'd3', name: 'DPS 3', role: 'dps', hp: 45000, output: 10000, burstMul: 1.8, burstDurationSec: 20, burstCooldownSec: 120, mitigation: 0.08 },
    { id: 'd4', name: 'DPS 4', role: 'dps', hp: 45000, output: 10000, burstMul: 1.8, burstDurationSec: 20, burstCooldownSec: 120, mitigation: 0.08 },
    { id: 'd5', name: 'DPS 5', role: 'dps', hp: 45000, output: 10000, burstMul: 1.8, burstDurationSec: 20, burstCooldownSec: 120, mitigation: 0.08 },
  ];
}

/** WoW 하드모드 보스 프리셋 — 3페이즈 + 7분 enrage */
export const BOSS_PRESETS: RaidBoss[] = [
  {
    id: 'heroic',
    name: '하드 보스',
    totalHp: 3_500_000,
    enrageAtSec: 420, // 7분
    phases: [
      { startAtHpPct: 1.0, raidWideDps: 1800, tankDps: 2500, label: 'P1 (100-70%)' },
      { startAtHpPct: 0.7, raidWideDps: 2500, tankDps: 3500, label: 'P2 (70-30%)' },
      { startAtHpPct: 0.3, raidWideDps: 3200, tankDps: 5000, label: 'P3 분노 (30%-)', isEnrage: true },
    ],
  },
  {
    id: 'mythic',
    name: '신화 보스',
    totalHp: 5_000_000,
    enrageAtSec: 480,
    phases: [
      { startAtHpPct: 1.0, raidWideDps: 2400, tankDps: 3500, label: 'P1' },
      { startAtHpPct: 0.8, raidWideDps: 3200, tankDps: 4200, label: 'P2' },
      { startAtHpPct: 0.5, raidWideDps: 4000, tankDps: 5500, label: 'P3' },
      { startAtHpPct: 0.2, raidWideDps: 5000, tankDps: 7000, label: 'P4 버서크', isEnrage: true },
    ],
  },
];
