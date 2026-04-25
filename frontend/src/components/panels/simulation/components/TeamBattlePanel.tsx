/**
 * TeamBattlePanel - 팀 전투 모드 UI 컴포넌트
 */

'use client';

import { useState } from 'react';
import { X, Play, RefreshCw, User, Sparkles, Target, Zap, Clock, BarChart3, Trophy, Skull, ChevronDown, ChevronUp, TrendingUp, Swords, Crosshair, Brain, Gauge } from 'lucide-react';
import type { UnitStats, TeamBattleConfig, Skill } from '@/lib/simulation/types';
import type { TeamResult, TeamUnitModalState } from '../hooks/useSimulationState';
import { UnitPicker } from './UnitPicker';
import { Histogram } from './Histogram';
import { Tooltip } from '@/components/ui/Tooltip';
import { useTranslations } from 'next-intl';
import CustomSelect from '@/components/ui/CustomSelect';
import ReplayTimeline, { type ReplayUnit } from '@/components/simulation/ReplayTimeline';

interface UnitWithSkills extends UnitStats {
  skills?: Skill[];
}

/** 팀 유닛들의 평균 composite skill (0-100). 지정 안 된 유닛은 50 기본값. */
function teamAverageSkills(units: UnitStats[]): { aim: number; reaction: number; decision: number } {
  if (units.length === 0) return { aim: 50, reaction: 50, decision: 50 };
  const sum = units.reduce(
    (acc, u) => ({
      aim: acc.aim + (u.aimSkill ?? 50),
      reaction: acc.reaction + (u.reactionSkill ?? 50),
      decision: acc.decision + (u.decisionSkill ?? 50),
    }),
    { aim: 0, reaction: 0, decision: 0 },
  );
  return {
    aim: Math.round(sum.aim / units.length),
    reaction: Math.round(sum.reaction / units.length),
    decision: Math.round(sum.decision / units.length),
  };
}

/** Team 헤더 옆에 평균 실력 3축 배지 */
function TeamSkillBadges({ units, color }: { units: UnitStats[]; color: string }) {
  if (units.length === 0) return null;
  const avg = teamAverageSkills(units);
  return (
    <div className="flex items-center gap-1">
      <span
        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-caption font-medium"
        style={{ background: `${color}15`, color }}
        title={`평균 에임 실력: ${avg.aim}/100`}
      >
        <Crosshair className="w-3 h-3" />
        {avg.aim}
      </span>
      <span
        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-caption font-medium"
        style={{ background: `${color}15`, color }}
        title={`평균 반응 실력: ${avg.reaction}/100`}
      >
        <Gauge className="w-3 h-3" />
        {avg.reaction}
      </span>
      <span
        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-caption font-medium"
        style={{ background: `${color}15`, color }}
        title={`평균 판단 실력: ${avg.decision}/100`}
      >
        <Brain className="w-3 h-3" />
        {avg.decision}
      </span>
    </div>
  );
}

// 유닛 카드 컴포넌트
function UnitCard({
  unit,
  index,
  color,
  onEdit,
  onRemove,
}: {
  unit: UnitWithSkills;
  index: number;
  color: string;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const hasAdvanced = unit.critRate || unit.critDamage || unit.evasion;
  const hasSkills = unit.skills && unit.skills.length > 0;
  const hasSkillProfile =
    unit.aimSkill !== undefined || unit.reactionSkill !== undefined || unit.decisionSkill !== undefined;

  return (
    <div
      className="p-2 rounded-lg cursor-pointer transition-all"
      style={{
        background: 'var(--bg-primary)',
        boxShadow: 'inset 0 0 0 1px transparent',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = `inset 0 0 0 1px ${color}`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = 'inset 0 0 0 1px transparent';
      }}
      onClick={onEdit}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0 flex-1">
          <div
            className="w-6 h-6 rounded flex items-center justify-center text-sm font-bold shrink-0"
            style={{ background: `${color}20`, color }}
          >
            {index + 1}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
              {unit.name}
            </div>
            <div className="flex items-center gap-2 text-xs flex-wrap" style={{ color: 'var(--text-secondary)' }}>
              <span>HP:{unit.maxHp}</span>
              <span>ATK:{unit.atk}</span>
              <span>DEF:{unit.def}</span>
              <span>SPD:{unit.speed}</span>
            </div>
            {/* 고급 옵션 */}
            {hasAdvanced && (
              <div className="flex items-center gap-2 text-xs mt-0.5 flex-wrap" style={{ color: 'var(--text-secondary)' }}>
                {unit.critRate !== undefined && unit.critRate > 0 && (
                  <span className="flex items-center gap-0.5">
                    <Target className="w-3 h-3" style={{ color: '#e5a440' }} />
                    {(unit.critRate * 100).toFixed(0)}%
                  </span>
                )}
                {unit.critDamage !== undefined && unit.critDamage !== 1.5 && (
                  <span className="flex items-center gap-0.5">
                    <Zap className="w-3 h-3" style={{ color: '#e5a440' }} />
                    x{unit.critDamage}
                  </span>
                )}
                {unit.evasion !== undefined && unit.evasion > 0 && (
                  <span>회피:{(unit.evasion * 100).toFixed(0)}%</span>
                )}
              </div>
            )}
            {/* 조종자 실력 composite */}
            {hasSkillProfile && (
              <div className="flex items-center gap-2 text-caption mt-0.5 flex-wrap" style={{ color: 'var(--text-secondary)' }}>
                {unit.aimSkill !== undefined && (
                  <span className="flex items-center gap-0.5" title="에임">
                    <Crosshair className="w-3 h-3" style={{ color: '#e86161' }} />
                    {unit.aimSkill}
                  </span>
                )}
                {unit.reactionSkill !== undefined && (
                  <span className="flex items-center gap-0.5" title="반응">
                    <Gauge className="w-3 h-3" style={{ color: '#5a9cf5' }} />
                    {unit.reactionSkill}
                  </span>
                )}
                {unit.decisionSkill !== undefined && (
                  <span className="flex items-center gap-0.5" title="판단">
                    <Brain className="w-3 h-3" style={{ color: '#9179f2' }} />
                    {unit.decisionSkill}
                  </span>
                )}
              </div>
            )}
            {/* 스킬 */}
            {hasSkills && (
              <div className="flex items-center gap-1 mt-1 flex-wrap">
                {unit.skills!.map((skill, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs"
                    style={{ background: `${color}15`, color }}
                    title={skill.name}
                  >
                    <Sparkles className="w-3 h-3" />
                    {skill.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="p-1 rounded hover:bg-[var(--bg-tertiary)] transition-colors shrink-0"
        >
          <X className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
        </button>
      </div>
    </div>
  );
}

interface TeamBattlePanelProps {
  team1Units: UnitStats[];
  team2Units: UnitStats[];
  units: UnitStats[];
  targetingMode: TeamBattleConfig['targetingMode'];
  setTargetingMode: (mode: TeamBattleConfig['targetingMode']) => void;
  teamResult: TeamResult | null;
  isRunning: boolean;
  runs: number;
  setRuns: (runs: number) => void;
  onRunSimulation: () => void;
  onAddToTeam: (team: 1 | 2, unit: UnitStats) => void;
  onRemoveFromTeam: (team: 1 | 2, unitId: string) => void;
  onOpenModal: (state: TeamUnitModalState) => void;
}

export function TeamBattlePanel({
  team1Units,
  team2Units,
  units,
  targetingMode,
  setTargetingMode,
  teamResult,
  isRunning,
  runs,
  setRuns,
  onRunSimulation,
  onAddToTeam,
  onRemoveFromTeam,
  onOpenModal,
}: TeamBattlePanelProps) {
  const t = useTranslations('simulation');

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Team 1 */}
        <div className="p-3 rounded-lg" style={{ background: 'var(--bg-tertiary)', border: '2px solid var(--primary-blue)' }}>
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="text-sm font-medium" style={{ color: 'var(--primary-blue)' }}>Team 1</div>
              <span className="text-sm px-1.5 py-0.5 rounded" style={{ background: 'var(--primary-blue)20', color: 'var(--primary-blue)' }}>
                {team1Units.length}
              </span>
              <TeamSkillBadges units={team1Units} color="var(--primary-blue)" />
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => onOpenModal({ isOpen: true, teamNumber: 1, editUnit: null })}
                className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-sm font-medium transition-all hover:scale-105"
                style={{ background: 'var(--primary-blue)15', color: 'var(--primary-blue)', border: '1.5px solid var(--primary-blue)' }}
              >
                <User className="w-3 h-3" />
                {t('newUnit')}
              </button>
              {units.length > 0 && (
                <UnitPicker
                  units={units.filter(u => !team1Units.find(t => t.id === u.id))}
                  onSelect={(unit) => onAddToTeam(1, { ...unit, id: `team1_${Date.now()}_${unit.id}` })}
                  color="var(--primary-blue)"
                  buttonText={t('loadFromSheet')}
                />
              )}
            </div>
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {team1Units.map((unit, i) => (
              <UnitCard
                key={unit.id}
                unit={unit as UnitWithSkills}
                index={i}
                color="var(--primary-blue)"
                onEdit={() => onOpenModal({ isOpen: true, teamNumber: 1, editUnit: unit })}
                onRemove={() => onRemoveFromTeam(1, unit.id)}
              />
            ))}
            {team1Units.length === 0 && (
              <div className="text-center py-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
                {t('clickNewUnitOrSheet')}
              </div>
            )}
          </div>
        </div>

        {/* Team 2 */}
        <div className="p-3 rounded-lg" style={{ background: 'var(--bg-tertiary)', border: '2px solid var(--primary-red)' }}>
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="text-sm font-medium" style={{ color: 'var(--primary-red)' }}>Team 2</div>
              <span className="text-sm px-1.5 py-0.5 rounded" style={{ background: 'var(--primary-red)20', color: 'var(--primary-red)' }}>
                {team2Units.length}
              </span>
              <TeamSkillBadges units={team2Units} color="var(--primary-red)" />
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => onOpenModal({ isOpen: true, teamNumber: 2, editUnit: null })}
                className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-sm font-medium transition-all hover:scale-105"
                style={{ background: 'var(--primary-red)15', color: 'var(--primary-red)', border: '1.5px solid var(--primary-red)' }}
              >
                <User className="w-3 h-3" />
                {t('newUnit')}
              </button>
              {units.length > 0 && (
                <UnitPicker
                  units={units.filter(u => !team2Units.find(t => t.id === u.id))}
                  onSelect={(unit) => onAddToTeam(2, { ...unit, id: `team2_${Date.now()}_${unit.id}` })}
                  color="var(--primary-red)"
                  buttonText={t('loadFromSheet')}
                />
              )}
            </div>
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {team2Units.map((unit, i) => (
              <UnitCard
                key={unit.id}
                unit={unit as UnitWithSkills}
                index={i}
                color="var(--primary-red)"
                onEdit={() => onOpenModal({ isOpen: true, teamNumber: 2, editUnit: unit })}
                onRemove={() => onRemoveFromTeam(2, unit.id)}
              />
            ))}
            {team2Units.length === 0 && (
              <div className="text-center py-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
                {t('clickNewUnitOrSheet')}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 타겟팅 모드 선택 */}
      <div className="p-3 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
        <label className="block text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>{t('targetingMode')}</label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {(['random', 'lowest_hp', 'highest_atk', 'focused'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => setTargetingMode(mode)}
              className="px-3 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{
                background: targetingMode === mode ? 'var(--accent)' : 'var(--bg-primary)',
                color: targetingMode === mode ? 'white' : 'var(--text-secondary)',
              }}
            >
              {t(`targeting.${mode}`)}
            </button>
          ))}
        </div>
      </div>

      {/* 팀 전투 실행 버튼 */}
      <div className="flex gap-2">
        <button
          onClick={onRunSimulation}
          disabled={team1Units.length === 0 || team2Units.length === 0 || isRunning}
          className="flex-1 py-2.5 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
          style={{
            background: isRunning ? 'var(--bg-tertiary)' : 'var(--accent)',
            color: isRunning ? 'var(--text-secondary)' : 'white'
          }}
        >
          {isRunning ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              {t('running')}
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              {t('runTeamSimulation')}
            </>
          )}
        </button>
        <CustomSelect
          value={String(runs)}
          onChange={(v) => setRuns(Number(v))}
          disabled={isRunning}
          options={[
            { value: '100', label: '100' },
            { value: '500', label: '500' },
            { value: '1000', label: '1K' },
            { value: '5000', label: '5K' },
          ]}
          size="sm"
        />
      </div>

      {/* 팀 전투 결과 */}
      {teamResult && (
        <TeamBattleResults
          teamResult={teamResult}
          team1Units={team1Units}
          team2Units={team2Units}
        />
      )}
    </>
  );
}

interface TeamBattleResultsProps {
  teamResult: TeamResult;
  team1Units: UnitStats[];
  team2Units: UnitStats[];
}

function TeamBattleResults({ teamResult, team1Units, team2Units }: TeamBattleResultsProps) {
  const t = useTranslations('simulation');
  const [showDetailedStats, setShowDetailedStats] = useState(false);
  const [showUnitStats, setShowUnitStats] = useState(false);
  const [selectedSampleIndex, setSelectedSampleIndex] = useState(0);

  // 팀별 유닛 통계 분리
  const team1UnitStats = teamResult.unitStats?.filter(u => u.team === 'team1') || [];
  const team2UnitStats = teamResult.unitStats?.filter(u => u.team === 'team2') || [];

  return (
    <div className="space-y-4">
      {/* 승률 */}
      <div className="p-4 rounded-xl" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)' }}>
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('teamWinRate')}</div>
          <div className="text-sm px-2 py-1 rounded-full" style={{ background: 'var(--bg-primary)', color: 'var(--text-secondary)' }}>
            {teamResult.totalRuns.toLocaleString()}전
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="font-medium" style={{ color: 'var(--primary-blue)' }}>Team 1 ({team1Units.length}명)</span>
              <span className="px-2 py-0.5 rounded" style={{ background: 'var(--primary-blue)15', color: 'var(--primary-blue)' }}>
                {teamResult.team1Wins.toLocaleString()}승
              </span>
            </div>
            <div className="relative h-8 rounded-lg overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
              <div
                className="absolute h-full transition-all"
                style={{
                  width: `${teamResult.team1WinRate * 100}%`,
                  background: 'var(--primary-blue)'
                }}
              />
              <div className="absolute inset-0 flex items-center justify-center text-sm font-bold" style={{ color: 'var(--text-primary)', textShadow: '0 0 4px var(--bg-primary)' }}>
                {(teamResult.team1WinRate * 100).toFixed(1)}%
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="font-medium" style={{ color: 'var(--primary-red)' }}>Team 2 ({team2Units.length}명)</span>
              <span className="px-2 py-0.5 rounded" style={{ background: 'var(--primary-red)15', color: 'var(--primary-red)' }}>
                {teamResult.team2Wins.toLocaleString()}승
              </span>
            </div>
            <div className="relative h-8 rounded-lg overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
              <div
                className="absolute h-full transition-all"
                style={{
                  width: `${teamResult.team2WinRate * 100}%`,
                  background: 'var(--primary-red)'
                }}
              />
              <div className="absolute inset-0 flex items-center justify-center text-sm font-bold" style={{ color: 'var(--text-primary)', textShadow: '0 0 4px var(--bg-primary)' }}>
                {(teamResult.team2WinRate * 100).toFixed(1)}%
              </div>
            </div>
          </div>

          {teamResult.draws > 0 && (
            <div className="flex items-center justify-center gap-2 pt-2 border-t" style={{ borderColor: 'var(--border-primary)' }}>
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                {t('draw')}: {teamResult.draws.toLocaleString()} ({((teamResult.draws / teamResult.totalRuns) * 100).toFixed(1)}%)
              </span>
            </div>
          )}
        </div>
      </div>

      {/* DPS 비교 */}
      {teamResult.team1DPS !== undefined && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-4 rounded-xl" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)' }}>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--accent)20' }}>
                <Zap className="w-4 h-4" style={{ color: 'var(--accent)' }} />
              </div>
              <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('teamDps')}</span>
            </div>
            <div className="space-y-3">
              <div className="p-2 rounded-lg" style={{ background: 'var(--bg-primary)' }}>
                <div className="text-sm mb-1 font-medium" style={{ color: 'var(--primary-blue)' }}>Team 1</div>
                <div className="flex items-baseline gap-2">
                  <span className="text-xl font-bold" style={{ color: 'var(--primary-blue)' }}>
                    {teamResult.team1DPS.toFixed(1)}
                  </span>
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>DPS</span>
                </div>
                <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                  {t('avgTotalDamage')}: {teamResult.avgTeam1Damage.toFixed(0)}
                </div>
              </div>
              <div className="p-2 rounded-lg" style={{ background: 'var(--bg-primary)' }}>
                <div className="text-sm mb-1 font-medium" style={{ color: 'var(--primary-red)' }}>Team 2</div>
                <div className="flex items-baseline gap-2">
                  <span className="text-xl font-bold" style={{ color: 'var(--primary-red)' }}>
                    {teamResult.team2DPS.toFixed(1)}
                  </span>
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>DPS</span>
                </div>
                <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                  {t('avgTotalDamage')}: {teamResult.avgTeam2Damage.toFixed(0)}
                </div>
              </div>
            </div>
          </div>

          {/* 역전 & 박빙 분석 */}
          <div className="p-4 rounded-xl" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)' }}>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: '#e5a44020' }}>
                <TrendingUp className="w-4 h-4" style={{ color: '#e5a440' }} />
              </div>
              <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('battleAnalysis')}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2 rounded-lg text-center" style={{ background: 'var(--bg-primary)' }}>
                <div className="text-lg font-bold" style={{ color: 'var(--primary-blue)' }}>{teamResult.team1Reversals}</div>
                <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>T1 {t('reversalWins')}</div>
              </div>
              <div className="p-2 rounded-lg text-center" style={{ background: 'var(--bg-primary)' }}>
                <div className="text-lg font-bold" style={{ color: 'var(--primary-red)' }}>{teamResult.team2Reversals}</div>
                <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>T2 {t('reversalWins')}</div>
              </div>
              <div className="p-2 rounded-lg text-center col-span-2" style={{ background: 'var(--bg-primary)' }}>
                <div className="text-lg font-bold" style={{ color: '#9179f2' }}>{teamResult.closeMatches}</div>
                <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t('closeMatches')}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 통계 요약 */}
      <div className="grid grid-cols-3 gap-2">
        <div className="p-3 rounded-xl text-center transition-transform hover:scale-105" style={{ background: 'linear-gradient(135deg, var(--bg-tertiary), var(--bg-primary))', border: '1px solid var(--border-primary)' }}>
          <div className="text-sm mb-1 font-medium" style={{ color: 'var(--text-secondary)' }}>{t('avgBattleTime')}</div>
          <div className="text-xl font-bold" style={{ color: 'var(--accent)' }}>
            {teamResult.avgDuration.toFixed(1)}<span className="text-sm font-normal">s</span>
          </div>
        </div>
        <div className="p-3 rounded-xl text-center transition-transform hover:scale-105" style={{ background: 'linear-gradient(135deg, var(--bg-tertiary), var(--bg-primary))', border: '1px solid var(--border-primary)' }}>
          <div className="text-sm mb-1 font-medium" style={{ color: 'var(--text-secondary)' }}>{t('avgSurvivors')} (T1)</div>
          <div className="text-xl font-bold" style={{ color: 'var(--primary-blue)' }}>
            {teamResult.avgTeam1Survivors.toFixed(1)}
          </div>
        </div>
        <div className="p-3 rounded-xl text-center transition-transform hover:scale-105" style={{ background: 'linear-gradient(135deg, var(--bg-tertiary), var(--bg-primary))', border: '1px solid var(--border-primary)' }}>
          <div className="text-sm mb-1 font-medium" style={{ color: 'var(--text-secondary)' }}>{t('avgSurvivors')} (T2)</div>
          <div className="text-xl font-bold" style={{ color: 'var(--primary-red)' }}>
            {teamResult.avgTeam2Survivors.toFixed(1)}
          </div>
        </div>
      </div>

      {/* 전투 시간 분포 히스토그램 */}
      {teamResult.durationDistribution && teamResult.durationDistribution.length > 0 && (
        <div className="p-4 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="w-4 h-4" style={{ color: 'var(--accent)' }} />
            <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{t('distribution')}</span>
          </div>
          <Histogram
            data={teamResult.durationDistribution}
            label={t('battleTimeDist')}
            color="var(--accent)"
            unit="s"
            rangeLabels={{ min: teamResult.minDuration, max: teamResult.maxDuration }}
          />
        </div>
      )}

      {/* 유닛별 데미지 비교 그래프 */}
      {teamResult.unitStats && teamResult.unitStats.length > 0 && (
        <div className="p-4 rounded-xl space-y-4" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)' }}>
          <div className="flex items-center gap-2">
            <Swords className="w-4 h-4" style={{ color: '#e5a440' }} />
            <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('damageComparison')}</span>
          </div>

          {/* 유닛별 데미지 막대 그래프 */}
          <div className="space-y-2">
            {(() => {
              const maxDamage = Math.max(...teamResult.unitStats.map(u => u.avgDamageDealt));
              return teamResult.unitStats.map((unit) => {
                const isTeam1 = unit.team === 'team1';
                const color = isTeam1 ? 'var(--primary-blue)' : 'var(--primary-red)';
                const widthPercent = maxDamage > 0 ? (unit.avgDamageDealt / maxDamage) * 100 : 0;
                return (
                  <div key={unit.unitId} className="flex items-center gap-2">
                    <div className="w-20 text-xs truncate text-right" style={{ color: 'var(--text-secondary)' }}>
                      {unit.unitName}
                    </div>
                    <div className="flex-1 h-5 rounded overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
                      <div
                        className="h-full rounded transition-all flex items-center justify-end pr-2"
                        style={{ width: `${widthPercent}%`, background: color }}
                      >
                        {widthPercent > 30 && (
                          <span className="text-xs font-medium text-white">{unit.avgDamageDealt.toFixed(0)}</span>
                        )}
                      </div>
                    </div>
                    {widthPercent <= 30 && (
                      <span className="text-xs w-12" style={{ color: 'var(--text-secondary)' }}>{unit.avgDamageDealt.toFixed(0)}</span>
                    )}
                  </div>
                );
              });
            })()}
          </div>

          {/* 생존율 비교 그래프 - 팀별 분리 */}
          <div className="pt-3 border-t" style={{ borderColor: 'var(--border-primary)' }}>
            <div className="text-sm font-medium mb-3" style={{ color: 'var(--text-secondary)' }}>{t('survivalRateComparison')}</div>

            {/* Team 1 */}
            <div className="mb-3">
              <div className="text-xs font-medium mb-2" style={{ color: 'var(--primary-blue)' }}>Team 1</div>
              <div className="space-y-1">
                {team1UnitStats.map((unit) => {
                  const survivalPercent = unit.survivalRate * 100;
                  return (
                    <div key={unit.unitId + '_survival'} className="flex items-center gap-2">
                      <div className="w-20 text-xs truncate text-right" style={{ color: 'var(--text-secondary)' }}>
                        {unit.unitName}
                      </div>
                      <div className="flex-1 h-4 rounded overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
                        <div
                          className="h-full rounded transition-all"
                          style={{
                            width: `${survivalPercent}%`,
                            background: 'var(--primary-blue)'
                          }}
                        />
                      </div>
                      <span className="text-xs w-12" style={{ color: 'var(--text-secondary)' }}>{survivalPercent.toFixed(0)}%</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Team 2 */}
            <div>
              <div className="text-xs font-medium mb-2" style={{ color: 'var(--primary-red)' }}>Team 2</div>
              <div className="space-y-1">
                {team2UnitStats.map((unit) => {
                  const survivalPercent = unit.survivalRate * 100;
                  return (
                    <div key={unit.unitId + '_survival'} className="flex items-center gap-2">
                      <div className="w-20 text-xs truncate text-right" style={{ color: 'var(--text-secondary)' }}>
                        {unit.unitName}
                      </div>
                      <div className="flex-1 h-4 rounded overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
                        <div
                          className="h-full rounded transition-all"
                          style={{
                            width: `${survivalPercent}%`,
                            background: 'var(--primary-red)'
                          }}
                        />
                      </div>
                      <span className="text-xs w-12" style={{ color: 'var(--text-secondary)' }}>{survivalPercent.toFixed(0)}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 유닛별 통계 토글 */}
      {teamResult.unitStats && teamResult.unitStats.length > 0 && (
        <>
          <button
            onClick={() => setShowUnitStats(!showUnitStats)}
            className="w-full flex items-center justify-between p-3 rounded-lg transition-colors hover:bg-[var(--bg-hover)]"
            style={{ background: 'var(--bg-tertiary)' }}
          >
            <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{t('unitStats')}</span>
            {showUnitStats ? (
              <ChevronUp className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
            ) : (
              <ChevronDown className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
            )}
          </button>

          {showUnitStats && (
            <div className="p-4 rounded-xl space-y-4" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)' }}>
              {/* Team 1 유닛 통계 */}
              <div>
                <div className="text-sm font-semibold mb-3" style={{ color: 'var(--primary-blue)' }}>Team 1 {t('unitStats')}</div>
                <div className="space-y-2">
                  {team1UnitStats.map((unit, idx) => (
                    <div key={unit.unitId} className="p-3 rounded-lg" style={{ background: 'var(--bg-primary)' }}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{unit.unitName}</span>
                          {unit.mvpCount > 0 && (
                            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs" style={{ background: '#e5a44020', color: '#e5a440' }}>
                              <Trophy className="w-3 h-3" />
                              MVP x{unit.mvpCount}
                            </span>
                          )}
                        </div>
                        <span className="text-xs px-2 py-0.5 rounded" style={{ background: unit.survivalRate > 0.5 ? '#3db88a20' : '#ef444420', color: unit.survivalRate > 0.5 ? '#3db88a' : '#ef4444' }}>
                          {t('survivalRate')}: {(unit.survivalRate * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                        <div>
                          <div className="font-medium" style={{ color: 'var(--primary-blue)' }}>{unit.avgDamageDealt.toFixed(0)}</div>
                          <div>{t('avgDamage')}</div>
                        </div>
                        <div>
                          <div className="font-medium" style={{ color: '#e5a440' }}>{unit.dps.toFixed(1)}</div>
                          <div>DPS</div>
                        </div>
                        <div>
                          <div className="font-medium" style={{ color: '#ef4444' }}>{unit.avgKills.toFixed(2)}</div>
                          <div>{t('avgKills')}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Team 2 유닛 통계 */}
              <div>
                <div className="text-sm font-semibold mb-3" style={{ color: 'var(--primary-red)' }}>Team 2 {t('unitStats')}</div>
                <div className="space-y-2">
                  {team2UnitStats.map((unit, idx) => (
                    <div key={unit.unitId} className="p-3 rounded-lg" style={{ background: 'var(--bg-primary)' }}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{unit.unitName}</span>
                          {unit.mvpCount > 0 && (
                            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs" style={{ background: '#e5a44020', color: '#e5a440' }}>
                              <Trophy className="w-3 h-3" />
                              MVP x{unit.mvpCount}
                            </span>
                          )}
                        </div>
                        <span className="text-xs px-2 py-0.5 rounded" style={{ background: unit.survivalRate > 0.5 ? '#3db88a20' : '#ef444420', color: unit.survivalRate > 0.5 ? '#3db88a' : '#ef4444' }}>
                          {t('survivalRate')}: {(unit.survivalRate * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                        <div>
                          <div className="font-medium" style={{ color: 'var(--primary-red)' }}>{unit.avgDamageDealt.toFixed(0)}</div>
                          <div>{t('avgDamage')}</div>
                        </div>
                        <div>
                          <div className="font-medium" style={{ color: '#e5a440' }}>{unit.dps.toFixed(1)}</div>
                          <div>DPS</div>
                        </div>
                        <div>
                          <div className="font-medium" style={{ color: '#ef4444' }}>{unit.avgKills.toFixed(2)}</div>
                          <div>{t('avgKills')}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* 샘플 전투 결과 */}
      {teamResult.sampleBattles && teamResult.sampleBattles.length > 0 && (
        <>
          <button
            onClick={() => setShowDetailedStats(!showDetailedStats)}
            className="w-full flex items-center justify-between p-3 rounded-lg transition-colors hover:bg-[var(--bg-hover)]"
            style={{ background: 'var(--bg-tertiary)' }}
          >
            <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{t('sampleBattleLog')}</span>
            {showDetailedStats ? (
              <ChevronUp className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
            ) : (
              <ChevronDown className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
            )}
          </button>

          {showDetailedStats && (
            <div className="p-4 rounded-xl space-y-4" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)' }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" style={{ color: 'var(--accent)' }} />
                  <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{t('sampleBattleLog')}</span>
                </div>
                <CustomSelect
                  value={String(selectedSampleIndex)}
                  onChange={(v) => setSelectedSampleIndex(Number(v))}
                  options={teamResult.sampleBattles.map((_, i) => ({
                    value: String(i),
                    label: `${t('battle')} #${i + 1}`
                  }))}
                  size="sm"
                />
              </div>

              {/* 샘플 전투 요약 */}
              {teamResult.sampleBattles[selectedSampleIndex] && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg" style={{ background: 'var(--bg-primary)' }}>
                      <div className="text-sm font-medium mb-2" style={{ color: 'var(--primary-blue)' }}>Team 1</div>
                      <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                        {t('survivors')}: {teamResult.sampleBattles[selectedSampleIndex].team1Survivors}/{team1Units.length}
                      </div>
                      <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                        {t('totalDamage')}: {teamResult.sampleBattles[selectedSampleIndex].team1TotalDamage.toLocaleString()}
                      </div>
                    </div>
                    <div className="p-3 rounded-lg" style={{ background: 'var(--bg-primary)' }}>
                      <div className="text-sm font-medium mb-2" style={{ color: 'var(--primary-red)' }}>Team 2</div>
                      <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                        {t('survivors')}: {teamResult.sampleBattles[selectedSampleIndex].team2Survivors}/{team2Units.length}
                      </div>
                      <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                        {t('totalDamage')}: {teamResult.sampleBattles[selectedSampleIndex].team2TotalDamage.toLocaleString()}
                      </div>
                    </div>
                  </div>

                  {/* 유닛별 결과 */}
                  <div className="max-h-64 overflow-y-auto space-y-1">
                    <div className="text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>{t('unitResults')}</div>
                    {teamResult.sampleBattles[selectedSampleIndex].unitResults.map((unitResult, idx) => {
                      const isTeam1 = unitResult.team === 'team1';
                      const color = isTeam1 ? 'var(--primary-blue)' : 'var(--primary-red)';
                      return (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-2 rounded-lg text-sm"
                          style={{ background: unitResult.survived ? 'var(--bg-primary)' : 'rgba(239, 68, 68, 0.1)' }}
                        >
                          <div className="flex items-center gap-2">
                            {!unitResult.survived && <Skull className="w-3 h-3" style={{ color: '#ef4444' }} />}
                            <span className="font-medium" style={{ color }}>{unitResult.unit.name}</span>
                          </div>
                          <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
                            <Tooltip content={t('damageDealt')} position="top">
                              <span className="flex items-center cursor-help"><Swords className="w-3 h-3 mr-1" />{unitResult.damageDealt.toLocaleString()}</span>
                            </Tooltip>
                            {unitResult.kills > 0 && (
                              <span className="px-1.5 py-0.5 rounded" style={{ background: '#ef444420', color: '#ef4444' }}>
                                {unitResult.kills} kill{unitResult.kills > 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="text-sm pt-2 border-t" style={{ borderColor: 'var(--border-primary)', color: 'var(--text-secondary)' }}>
                    {t('winner')}: <span className="font-medium" style={{
                      color: teamResult.sampleBattles[selectedSampleIndex].winner === 'team1'
                        ? 'var(--primary-blue)'
                        : teamResult.sampleBattles[selectedSampleIndex].winner === 'team2'
                          ? 'var(--primary-red)'
                          : 'var(--text-secondary)'
                    }}>
                      {teamResult.sampleBattles[selectedSampleIndex].winner === 'team1'
                        ? 'Team 1'
                        : teamResult.sampleBattles[selectedSampleIndex].winner === 'team2'
                          ? 'Team 2'
                          : t('draw')}
                    </span>
                    {' '}| {t('battleTime')}: {teamResult.sampleBattles[selectedSampleIndex].duration.toFixed(1)}s
                  </div>

                  {/* 시뮬 리플레이 — 다대다 timeline + scrubber */}
                  {teamResult.sampleBattles[selectedSampleIndex].log && (
                    <div className="pt-3 border-t" style={{ borderColor: 'var(--border-primary)' }}>
                      <div className="text-sm mb-2 font-medium" style={{ color: 'var(--text-secondary)' }}>시뮬 리플레이</div>
                      <ReplayTimeline
                        units={[
                          ...team1Units.map((u): ReplayUnit => ({ id: u.id, name: u.name, maxHp: u.maxHp, team: 'team1' })),
                          ...team2Units.map((u): ReplayUnit => ({ id: u.id, name: u.name, maxHp: u.maxHp, team: 'team2' })),
                        ]}
                        log={teamResult.sampleBattles[selectedSampleIndex].log ?? []}
                        summary={{
                          winnerLabel:
                            teamResult.sampleBattles[selectedSampleIndex].winner === 'team1'
                              ? 'Team 1'
                              : teamResult.sampleBattles[selectedSampleIndex].winner === 'team2'
                                ? 'Team 2'
                                : t('draw'),
                          duration: teamResult.sampleBattles[selectedSampleIndex].duration,
                        }}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
