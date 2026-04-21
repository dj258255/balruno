import { describe, it, expect } from 'vitest';
import { simulateFpsTeamBattle, type FpsTeamPlayer } from './fpsTeamSimulation';
import { WEAPON_PRESETS, aimSkillToProfile } from './fpsSimulation';

function makePlayer(id: string, aimSkill: number): FpsTeamPlayer {
  return {
    id,
    name: id,
    weapon: { ...WEAPON_PRESETS[0] },
    player: { hp: 100, shield: 50, armor: 0 },
    aim: aimSkillToProfile(aimSkill),
  };
}

describe('simulateFpsTeamBattle', () => {
  it('3v3 같은 실력 → 양팀 모두 이길 수 있음 (한쪽이 0 이 아님)', () => {
    const teamA = [makePlayer('a1', 60), makePlayer('a2', 60), makePlayer('a3', 60)];
    const teamB = [makePlayer('b1', 60), makePlayer('b2', 60), makePlayer('b3', 60)];
    const result = simulateFpsTeamBattle(teamA, teamB, { distance: 15, startDelayMs: 0 }, 1000);
    expect(result.teamAWinRate).toBeGreaterThan(0.1);
    expect(result.teamBWinRate).toBeGreaterThan(0.1);
  });

  it('3v3 실력 차이 (초보 vs 숙련) → 숙련팀 압승', () => {
    const noob = [makePlayer('a1', 20), makePlayer('a2', 20), makePlayer('a3', 20)];
    const pro = [makePlayer('b1', 90), makePlayer('b2', 90), makePlayer('b3', 90)];
    const result = simulateFpsTeamBattle(noob, pro, { distance: 15, startDelayMs: 0 }, 1000);
    expect(result.teamBWinRate).toBeGreaterThan(0.75);
  });

  it('trade-kill 지표가 존재하고 [0, 1] 범위', () => {
    const teamA = [makePlayer('a1', 60), makePlayer('a2', 60)];
    const teamB = [makePlayer('b1', 60), makePlayer('b2', 60)];
    const result = simulateFpsTeamBattle(teamA, teamB, { distance: 15, startDelayMs: 0 }, 500);
    expect(result.tradeKillRate).toBeGreaterThanOrEqual(0);
    expect(result.tradeKillRate).toBeLessThanOrEqual(1);
  });

  it('player 개별 stats: kills/deaths/damage 추적', () => {
    const teamA = [makePlayer('a1', 80), makePlayer('a2', 80)];
    const teamB = [makePlayer('b1', 40), makePlayer('b2', 40)];
    const result = simulateFpsTeamBattle(teamA, teamB, { distance: 15, startDelayMs: 0 }, 500);
    expect(result.playerStats.a1.kills).toBeGreaterThan(0);
    expect(result.playerStats.b1.deaths).toBeGreaterThan(0);
    expect(result.playerStats.a1.damage).toBeGreaterThan(0);
  });

  it('5v5 도 동작', () => {
    const teamA = Array.from({ length: 5 }, (_, i) => makePlayer(`a${i}`, 60));
    const teamB = Array.from({ length: 5 }, (_, i) => makePlayer(`b${i}`, 60));
    const result = simulateFpsTeamBattle(teamA, teamB, { distance: 20, startDelayMs: 0 }, 300);
    expect(result.teamAWinRate + result.teamBWinRate).toBeGreaterThan(0.9);
  });
});
