/**
 * SimulationResults - 1v1 시뮬레이션 결과 표시 컴포넌트
 */

'use client';

import { BarChart3, Clock, Zap, TrendingUp, ChevronDown, ChevronUp, Download, Heart, Shield, RotateCcw, Sparkles, Activity, Swords, FileSpreadsheet } from 'lucide-react';
import type { UnitStats, SimulationResult } from '@/lib/simulation/types';
import { Histogram } from './Histogram';
import { HpTimelineGraph } from './HpTimelineGraph';
import { ConfidenceBar } from './ConfidenceBar';
import { useTranslations } from 'next-intl';
import CustomSelect from '@/components/ui/CustomSelect';
import ReplayTimeline, { type ReplayUnit } from '@/components/simulation/ReplayTimeline';

interface SimulationResultsProps {
  result: SimulationResult;
  unit1Stats: UnitStats;
  unit2Stats: UnitStats;
  showDetailedStats: boolean;
  setShowDetailedStats: (show: boolean) => void;
  selectedBattleIndex: number;
  setSelectedBattleIndex: (index: number) => void;
  onExport: (format: 'json' | 'csv') => void;
  /** 제공 시 "시트에 저장" 버튼 노출 — 결과를 현재 시트에 행으로 commit */
  onSaveToSheet?: () => void;
}

export function SimulationResults({
  result,
  unit1Stats,
  unit2Stats,
  showDetailedStats,
  setShowDetailedStats,
  selectedBattleIndex,
  setSelectedBattleIndex,
  onExport,
  onSaveToSheet,
}: SimulationResultsProps) {
  const t = useTranslations('simulation');

  return (
    <div className="space-y-4">
      {/* 승률 */}
      <div className="p-4 rounded-xl" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)' }}>
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('winRate')}</div>
          <div className="text-sm px-2 py-1 rounded-full" style={{ background: 'var(--bg-primary)', color: 'var(--text-secondary)' }}>
            {result.totalRuns.toLocaleString()}전
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="font-medium" style={{ color: 'var(--primary-blue)' }}>{unit1Stats.name}</span>
              <span className="px-2 py-0.5 rounded" style={{ background: 'var(--primary-blue)15', color: 'var(--primary-blue)' }}>
                {result.unit1Wins.toLocaleString()}승
              </span>
            </div>
            <ConfidenceBar
              winRate={result.unit1WinRate}
              confidence={result.winRateConfidence.unit1}
              color="var(--primary-blue)"
              wins={result.unit1Wins}
              total={result.totalRuns}
            />
          </div>

          <div>
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="font-medium" style={{ color: 'var(--primary-red)' }}>{unit2Stats.name}</span>
              <span className="px-2 py-0.5 rounded" style={{ background: 'var(--primary-red)15', color: 'var(--primary-red)' }}>
                {result.unit2Wins.toLocaleString()}승
              </span>
            </div>
            <ConfidenceBar
              winRate={result.unit2WinRate}
              confidence={result.winRateConfidence.unit2}
              color="var(--primary-red)"
              wins={result.unit2Wins}
              total={result.totalRuns}
            />
          </div>

          {result.draws > 0 && (
            <div className="flex items-center justify-center gap-2 pt-2 border-t" style={{ borderColor: 'var(--border-primary)' }}>
              <div className="w-3 h-3 rounded-full" style={{ background: 'var(--text-secondary)' }} />
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                {t('draw')}: {result.draws.toLocaleString()} ({((result.draws / result.totalRuns) * 100).toFixed(1)}%)
              </span>
            </div>
          )}
        </div>
      </div>

      {/* TTK & DPS 통계 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* TTK 카드 */}
        <div className="p-4 rounded-xl" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)' }}>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--primary-yellow)20' }}>
              <Clock className="w-4 h-4" style={{ color: 'var(--primary-yellow)' }} />
            </div>
            <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('ttk')}</span>
          </div>
          <div className="space-y-3">
            <div className="p-2 rounded-lg" style={{ background: 'var(--bg-primary)' }}>
              <div className="text-sm mb-1 font-medium" style={{ color: 'var(--primary-blue)' }}>
                {unit1Stats.name}
              </div>
              {result.ttkStats?.unit1 && result.ttkStats.unit1.avg > 0 ? (
                <div className="flex items-baseline gap-2">
                  <span className="text-xl font-bold" style={{ color: 'var(--primary-blue)' }}>
                    {result.ttkStats.unit1.avg.toFixed(1)}s
                  </span>
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    ({result.ttkStats.unit1.min.toFixed(1)}~{result.ttkStats.unit1.max.toFixed(1)}s)
                  </span>
                </div>
              ) : (
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('noWin')}</span>
              )}
            </div>
            <div className="p-2 rounded-lg" style={{ background: 'var(--bg-primary)' }}>
              <div className="text-sm mb-1 font-medium" style={{ color: 'var(--primary-red)' }}>
                {unit2Stats.name}
              </div>
              {result.ttkStats?.unit2 && result.ttkStats.unit2.avg > 0 ? (
                <div className="flex items-baseline gap-2">
                  <span className="text-xl font-bold" style={{ color: 'var(--primary-red)' }}>
                    {result.ttkStats.unit2.avg.toFixed(1)}s
                  </span>
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    ({result.ttkStats.unit2.min.toFixed(1)}~{result.ttkStats.unit2.max.toFixed(1)}s)
                  </span>
                </div>
              ) : (
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('noWin')}</span>
              )}
            </div>
          </div>
        </div>

        {/* DPS 카드 */}
        <div className="p-4 rounded-xl" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)' }}>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--accent)20' }}>
              <Zap className="w-4 h-4" style={{ color: 'var(--accent)' }} />
            </div>
            <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('dpsComparison')}</span>
          </div>
          <div className="space-y-3">
            <div className="p-2 rounded-lg" style={{ background: 'var(--bg-primary)' }}>
              <div className="text-sm mb-1 font-medium" style={{ color: 'var(--primary-blue)' }}>{unit1Stats.name}</div>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-bold" style={{ color: 'var(--primary-blue)' }}>
                  {result.unit1AvgDps.toFixed(1)}
                </span>
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>DPS</span>
                {result.theoreticalDps && result.unit1AvgDps < result.theoreticalDps.unit1 * 0.9 && (
                  <span className="text-sm px-1.5 py-0.5 rounded" style={{ background: '#fef3c720', color: '#eab308' }}>
                    -{((1 - result.unit1AvgDps / result.theoreticalDps.unit1) * 100).toFixed(0)}%
                  </span>
                )}
              </div>
            </div>
            <div className="p-2 rounded-lg" style={{ background: 'var(--bg-primary)' }}>
              <div className="text-sm mb-1 font-medium" style={{ color: 'var(--primary-red)' }}>{unit2Stats.name}</div>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-bold" style={{ color: 'var(--primary-red)' }}>
                  {result.unit2AvgDps.toFixed(1)}
                </span>
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>DPS</span>
                {result.theoreticalDps && result.unit2AvgDps < result.theoreticalDps.unit2 * 0.9 && (
                  <span className="text-sm px-1.5 py-0.5 rounded" style={{ background: '#fef3c720', color: '#eab308' }}>
                    -{((1 - result.unit2AvgDps / result.theoreticalDps.unit2) * 100).toFixed(0)}%
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 통계 요약 */}
      <div className="grid grid-cols-3 gap-2">
        <div className="p-3 rounded-xl text-center transition-transform hover:scale-105" style={{ background: 'linear-gradient(135deg, var(--bg-tertiary), var(--bg-primary))', border: '1px solid var(--border-primary)' }}>
          <div className="text-sm mb-1 font-medium" style={{ color: 'var(--text-secondary)' }}>{t('avgBattleTime')}</div>
          <div className="text-xl font-bold" style={{ color: 'var(--accent)' }}>
            {result.avgDuration.toFixed(1)}<span className="text-sm font-normal">s</span>
          </div>
        </div>
        <div className="p-3 rounded-xl text-center transition-transform hover:scale-105" style={{ background: 'linear-gradient(135deg, var(--bg-tertiary), var(--bg-primary))', border: '1px solid var(--border-primary)' }}>
          <div className="text-sm mb-1 font-medium" style={{ color: 'var(--text-secondary)' }}>{t('totalSimulations')}</div>
          <div className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
            {result.totalRuns >= 1000 ? `${(result.totalRuns / 1000).toFixed(0)}K` : result.totalRuns}
          </div>
        </div>
        <div className="p-3 rounded-xl text-center transition-transform hover:scale-105" style={{ background: 'linear-gradient(135deg, var(--bg-tertiary), var(--bg-primary))', border: '1px solid var(--border-primary)' }}>
          <div className="text-sm mb-1 font-medium" style={{ color: 'var(--text-secondary)' }}>{t('timeRange')}</div>
          <div className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
            {result.minDuration.toFixed(1)}~{result.maxDuration.toFixed(1)}<span className="text-sm font-normal">s</span>
          </div>
        </div>
      </div>

      {/* 히스토그램 */}
      <div className="p-4 rounded-lg space-y-5" style={{ background: 'var(--bg-tertiary)' }}>
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4" style={{ color: 'var(--accent)' }} />
          <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{t('distribution')}</span>
        </div>

        <Histogram
          data={result.durationDistribution}
          label={t('battleTimeDist')}
          color="var(--accent)"
          unit="s"
          rangeLabels={{ min: result.minDuration, max: result.maxDuration }}
        />

        <Histogram
          data={result.damageDistribution.unit1}
          label={t('totalDamageDist', { name: unit1Stats.name || '' })}
          color="var(--primary-blue)"
          rangeLabels={result.damageDistribution.unit1Range}
        />

        <Histogram
          data={result.damageDistribution.unit2}
          label={t('totalDamageDist', { name: unit2Stats.name || '' })}
          color="var(--primary-red)"
          rangeLabels={result.damageDistribution.unit2Range}
        />
      </div>

      {/* 상세 통계 토글 */}
      <button
        onClick={() => setShowDetailedStats(!showDetailedStats)}
        className="w-full flex items-center justify-between p-3 rounded-lg transition-colors hover:bg-[var(--bg-hover)]"
        style={{ background: 'var(--bg-tertiary)' }}
      >
        <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{t('detailedStats')}</span>
        {showDetailedStats ? (
          <ChevronUp className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
        ) : (
          <ChevronDown className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
        )}
      </button>

      {showDetailedStats && (
        <div className="p-4 rounded-lg space-y-3" style={{ background: 'var(--bg-tertiary)' }}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div>
              <div className="font-medium mb-2" style={{ color: 'var(--primary-blue)' }}>{unit1Stats.name}</div>
              <div className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                <div>{t('wins')}: {result.unit1Wins}</div>
                <div>{t('avgDamage')}: {result.unit1AvgDamage.toFixed(0)}</div>
                <div>{t('avgSurvivalHp')}: {result.unit1AvgSurvivalHp.toFixed(0)}</div>
              </div>
            </div>
            <div>
              <div className="font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>{t('draw')}</div>
              <div className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                <div>{result.draws.toLocaleString()}</div>
                <div>({((result.draws / result.totalRuns) * 100).toFixed(1)}%)</div>
              </div>
            </div>
            <div>
              <div className="font-medium mb-2" style={{ color: 'var(--primary-red)' }}>{unit2Stats.name}</div>
              <div className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                <div>{t('wins')}: {result.unit2Wins}</div>
                <div>{t('avgDamage')}: {result.unit2AvgDamage.toFixed(0)}</div>
                <div>{t('avgSurvivalHp')}: {result.unit2AvgSurvivalHp.toFixed(0)}</div>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t" style={{ borderColor: 'var(--border-primary)' }}>
            <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {t('battleTimeRange')}: {result.minDuration.toFixed(1)}s ~ {result.maxDuration.toFixed(1)}s
            </div>
          </div>
        </div>
      )}

      {/* 샘플 전투 로그 */}
      {result.sampleBattles.length > 0 && (
        <div className="p-4 rounded-lg space-y-3" style={{ background: 'var(--bg-tertiary)' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" style={{ color: 'var(--accent)' }} />
              <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{t('sampleBattleLog')}</span>
            </div>
            <CustomSelect
              value={String(selectedBattleIndex)}
              onChange={(v) => setSelectedBattleIndex(Number(v))}
              options={result.sampleBattles.map((_, i) => ({
                value: String(i),
                label: `${t('battle')} #${i + 1}`
              }))}
              size="sm"
            />
          </div>

          {/* HP 타임라인 그래프 — 전체 전투 한 눈에 (정적) */}
          {result.sampleBattles[selectedBattleIndex]?.log && (
            <div className="pt-2">
              <div className="text-sm mb-2 font-medium" style={{ color: 'var(--text-secondary)' }}>{t('hpTimeline')}</div>
              <HpTimelineGraph
                log={result.sampleBattles[selectedBattleIndex].log}
                unit1Name={unit1Stats.name}
                unit2Name={unit2Stats.name}
                unit1MaxHp={unit1Stats.maxHp}
                unit2MaxHp={unit2Stats.maxHp}
              />
            </div>
          )}

          {/* 시뮬 리플레이 — scrubber + step-by-step 인터랙티브 재생 */}
          {result.sampleBattles[selectedBattleIndex]?.log && (
            <div className="pt-2">
              <div className="text-sm mb-2 font-medium" style={{ color: 'var(--text-secondary)' }}>시뮬 리플레이</div>
              <ReplayTimeline
                units={[
                  { id: unit1Stats.id, name: unit1Stats.name, maxHp: unit1Stats.maxHp } satisfies ReplayUnit,
                  { id: unit2Stats.id, name: unit2Stats.name, maxHp: unit2Stats.maxHp } satisfies ReplayUnit,
                ]}
                log={result.sampleBattles[selectedBattleIndex].log}
                summary={{
                  winnerLabel:
                    result.sampleBattles[selectedBattleIndex].winner === 'unit1'
                      ? unit1Stats.name
                      : result.sampleBattles[selectedBattleIndex].winner === 'unit2'
                        ? unit2Stats.name
                        : t('draw'),
                  duration: result.sampleBattles[selectedBattleIndex].duration,
                }}
              />
            </div>
          )}

          <div className="max-h-48 overflow-y-auto space-y-1">
            {result.sampleBattles[selectedBattleIndex]?.log.map((entry, i) => {
              const actorColor = entry.actor === unit1Stats.name ? 'var(--primary-blue)' : 'var(--primary-red)';
              const getActionBackground = () => {
                switch (entry.action) {
                  case 'death': return 'rgba(255, 0, 0, 0.1)';
                  case 'skill': return 'rgba(229, 168, 64, 0.1)';
                  case 'heal': return 'rgba(61, 184, 138, 0.1)';
                  case 'hot_tick': return 'rgba(61, 184, 138, 0.05)';
                  case 'invincible': return 'rgba(90, 156, 245, 0.1)';
                  case 'revive': return 'rgba(161, 150, 245, 0.1)';
                  default: return 'transparent';
                }
              };

              return (
                <div
                  key={i}
                  className="flex items-center gap-2 text-sm py-1 px-2 rounded"
                  style={{ background: getActionBackground() }}
                >
                  <span className="w-12 text-right shrink-0" style={{ color: 'var(--text-secondary)' }}>
                    {entry.time.toFixed(1)}s
                  </span>
                  <span className="font-medium shrink-0" style={{ color: actorColor }}>
                    {entry.actor}
                  </span>

                  {/* 일반 공격 */}
                  {entry.action === 'attack' && (
                    <>
                      <span style={{ color: 'var(--text-secondary)' }}>→</span>
                      <span style={{ color: 'var(--text-secondary)' }}>
                        {entry.isMiss ? (
                          <span className="text-yellow-500">MISS</span>
                        ) : (
                          <>
                            {entry.damage}
                            {entry.isCrit && <span className="text-orange-500 ml-1">CRIT!</span>}
                          </>
                        )}
                      </span>
                      <span className="truncate" style={{ color: 'var(--text-secondary)' }}>
                        ({entry.target} HP: {entry.remainingHp?.toFixed(0)})
                      </span>
                    </>
                  )}

                  {/* 스킬 데미지 */}
                  {entry.action === 'skill' && (
                    <>
                      <Sparkles className="w-3 h-3 shrink-0" style={{ color: '#e5a440' }} />
                      <span className="font-medium" style={{ color: '#e5a440' }}>{entry.skillName}</span>
                      {entry.damage !== undefined && entry.damage > 0 && (
                        <>
                          <span style={{ color: 'var(--text-secondary)' }}>→</span>
                          <span style={{ color: 'var(--text-secondary)' }}>
                            {entry.isMiss ? (
                              <span className="text-yellow-500">BLOCKED</span>
                            ) : (
                              <span className="text-orange-400">{entry.damage}</span>
                            )}
                          </span>
                        </>
                      )}
                      {entry.remainingHp !== undefined && entry.target && (
                        <span className="truncate" style={{ color: 'var(--text-secondary)' }}>
                          ({entry.target} HP: {entry.remainingHp.toFixed(0)})
                        </span>
                      )}
                    </>
                  )}

                  {/* 힐 스킬 */}
                  {entry.action === 'heal' && (
                    <>
                      <Heart className="w-3 h-3 shrink-0" style={{ color: '#3db88a' }} />
                      <span className="font-medium" style={{ color: '#3db88a' }}>{entry.skillName}</span>
                      <span style={{ color: '#3db88a' }}>+{entry.healAmount}</span>
                      <span style={{ color: 'var(--text-secondary)' }}>(HP: {entry.remainingHp?.toFixed(0)})</span>
                    </>
                  )}

                  {/* HoT 틱 */}
                  {entry.action === 'hot_tick' && (
                    <>
                      <Activity className="w-3 h-3 shrink-0" style={{ color: '#3db88a' }} />
                      <span style={{ color: '#3db88a' }}>HoT</span>
                      <span style={{ color: '#3db88a' }}>+{entry.healAmount}</span>
                      <span style={{ color: 'var(--text-secondary)' }}>(HP: {entry.remainingHp?.toFixed(0)})</span>
                    </>
                  )}

                  {/* HoT 종료 */}
                  {entry.action === 'hot_end' && (
                    <>
                      <Activity className="w-3 h-3 shrink-0" style={{ color: 'var(--text-secondary)' }} />
                      <span style={{ color: 'var(--text-secondary)' }}>{entry.skillName} 종료</span>
                    </>
                  )}

                  {/* 무적 발동 */}
                  {entry.action === 'invincible' && (
                    <>
                      <Shield className="w-3 h-3 shrink-0" style={{ color: '#5a9cf5' }} />
                      <span className="font-medium" style={{ color: '#5a9cf5' }}>{entry.skillName}</span>
                      <span style={{ color: '#5a9cf5' }}>무적!</span>
                    </>
                  )}

                  {/* 무적 종료 */}
                  {entry.action === 'invincible_end' && (
                    <>
                      <Shield className="w-3 h-3 shrink-0" style={{ color: 'var(--text-secondary)' }} />
                      <span style={{ color: 'var(--text-secondary)' }}>무적 종료</span>
                    </>
                  )}

                  {/* 부활 */}
                  {entry.action === 'revive' && (
                    <>
                      <RotateCcw className="w-3 h-3 shrink-0" style={{ color: '#a896f5' }} />
                      <span className="font-medium" style={{ color: '#a896f5' }}>{entry.skillName}</span>
                      <span style={{ color: '#a896f5' }}>부활!</span>
                      <span style={{ color: 'var(--text-secondary)' }}>(HP: {entry.remainingHp?.toFixed(0)})</span>
                    </>
                  )}

                  {/* 사망 */}
                  {entry.action === 'death' && (
                    <span className="text-red-500 font-medium">{t('death')}</span>
                  )}
                </div>
              );
            })}
          </div>

          <div className="text-sm pt-2 border-t" style={{ borderColor: 'var(--border-primary)', color: 'var(--text-secondary)' }}>
            {t('winner')}: <span className="font-medium" style={{
              color: result.sampleBattles[selectedBattleIndex]?.winner === 'unit1'
                ? 'var(--primary-blue)'
                : result.sampleBattles[selectedBattleIndex]?.winner === 'unit2'
                  ? 'var(--primary-red)'
                  : 'var(--text-secondary)'
            }}>
              {result.sampleBattles[selectedBattleIndex]?.winner === 'unit1'
                ? unit1Stats.name
                : result.sampleBattles[selectedBattleIndex]?.winner === 'unit2'
                  ? unit2Stats.name
                  : t('draw')}
            </span>
            {' '}| {t('battleTime')}: {result.sampleBattles[selectedBattleIndex]?.duration.toFixed(1)}s
          </div>
        </div>
      )}

      {/* 치명타/역전 분석 */}
      {result.critStats && result.reversalAnalysis && (
        <div className="p-4 rounded-xl space-y-4" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)' }}>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4" style={{ color: '#e5a440' }} />
            <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('critAnalysis')}</span>
          </div>

          {/* 치명타 통계 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 rounded-lg" style={{ background: 'var(--bg-primary)' }}>
              <div className="text-sm font-medium mb-2" style={{ color: 'var(--primary-blue)' }}>{unit1Stats.name}</div>
              <div className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                <div className="flex justify-between">
                  <span>{t('totalCrits')}</span>
                  <span className="font-medium" style={{ color: '#e5a440' }}>{result.critStats.unit1.totalCrits.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>{t('totalHits')}</span>
                  <span>{result.critStats.unit1.totalHits.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>{t('actualCritRate')}</span>
                  <span className="font-medium" style={{ color: result.critStats.unit1.avgCritRate > (unit1Stats.critRate || 0) ? '#3db88a' : 'var(--text-secondary)' }}>
                    {(result.critStats.unit1.avgCritRate * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
            <div className="p-3 rounded-lg" style={{ background: 'var(--bg-primary)' }}>
              <div className="text-sm font-medium mb-2" style={{ color: 'var(--primary-red)' }}>{unit2Stats.name}</div>
              <div className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                <div className="flex justify-between">
                  <span>{t('totalCrits')}</span>
                  <span className="font-medium" style={{ color: '#e5a440' }}>{result.critStats.unit2.totalCrits.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>{t('totalHits')}</span>
                  <span>{result.critStats.unit2.totalHits.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>{t('actualCritRate')}</span>
                  <span className="font-medium" style={{ color: result.critStats.unit2.avgCritRate > (unit2Stats.critRate || 0) ? '#3db88a' : 'var(--text-secondary)' }}>
                    {(result.critStats.unit2.avgCritRate * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 역전 분석 */}
          <div className="pt-3 border-t" style={{ borderColor: 'var(--border-primary)' }}>
            <div className="text-sm font-medium mb-3" style={{ color: 'var(--text-secondary)' }}>{t('reversalAnalysis')}</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="p-2 rounded-lg text-center" style={{ background: 'var(--bg-primary)' }}>
                <div className="text-lg font-bold" style={{ color: 'var(--primary-blue)' }}>{result.reversalAnalysis.unit1Reversals}</div>
                <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>{unit1Stats.name} {t('reversalWins')}</div>
              </div>
              <div className="p-2 rounded-lg text-center" style={{ background: 'var(--bg-primary)' }}>
                <div className="text-lg font-bold" style={{ color: 'var(--primary-red)' }}>{result.reversalAnalysis.unit2Reversals}</div>
                <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>{unit2Stats.name} {t('reversalWins')}</div>
              </div>
              <div className="p-2 rounded-lg text-center" style={{ background: 'var(--bg-primary)' }}>
                <div className="text-lg font-bold" style={{ color: '#e5a440' }}>{result.reversalAnalysis.critCausedReversals}</div>
                <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('critReversals')}</div>
              </div>
              <div className="p-2 rounded-lg text-center" style={{ background: 'var(--bg-primary)' }}>
                <div className="text-lg font-bold" style={{ color: '#9179f2' }}>{result.reversalAnalysis.closeMatches}</div>
                <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('closeMatches')}</div>
              </div>
            </div>
            {(result.reversalAnalysis.unit1Reversals > 0 || result.reversalAnalysis.unit2Reversals > 0) && (
              <div className="mt-2 text-sm text-center" style={{ color: 'var(--text-secondary)' }}>
                {t('reversalRate')}: {(((result.reversalAnalysis.unit1Reversals + result.reversalAnalysis.unit2Reversals) / result.totalRuns) * 100).toFixed(1)}%
              </div>
            )}
          </div>
        </div>
      )}

      {/* 스킬 통계 */}
      {result.skillStats && (result.skillStats.unit1.length > 0 || result.skillStats.unit2.length > 0) && (
        <div className="p-4 rounded-xl space-y-4" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)' }}>
          <div className="flex items-center gap-2">
            <Swords className="w-4 h-4" style={{ color: '#e5a440' }} />
            <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('skillStats')}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Unit1 스킬 통계 */}
            {result.skillStats.unit1.length > 0 && (
              <div className="p-3 rounded-lg" style={{ background: 'var(--bg-primary)' }}>
                <div className="text-sm font-medium mb-3" style={{ color: 'var(--primary-blue)' }}>{unit1Stats.name}</div>
                <div className="space-y-2">
                  {result.skillStats.unit1.map((skill) => (
                    <div key={skill.skillId} className="text-sm">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{skill.skillName}</span>
                        <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
                          {(skill.totalUses / result.totalRuns).toFixed(1)}회/전투
                        </span>
                      </div>
                      <div className="flex gap-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
                        {skill.totalDamage > 0 && (
                          <span>
                            데미지: <span style={{ color: '#e5a440' }}>{skill.avgDamagePerUse.toFixed(0)}</span>/회
                          </span>
                        )}
                        {skill.totalHealing > 0 && (
                          <span>
                            힐: <span style={{ color: '#3db88a' }}>{(skill.totalHealing / skill.totalUses).toFixed(0)}</span>/회
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Unit2 스킬 통계 */}
            {result.skillStats.unit2.length > 0 && (
              <div className="p-3 rounded-lg" style={{ background: 'var(--bg-primary)' }}>
                <div className="text-sm font-medium mb-3" style={{ color: 'var(--primary-red)' }}>{unit2Stats.name}</div>
                <div className="space-y-2">
                  {result.skillStats.unit2.map((skill) => (
                    <div key={skill.skillId} className="text-sm">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{skill.skillName}</span>
                        <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
                          {(skill.totalUses / result.totalRuns).toFixed(1)}회/전투
                        </span>
                      </div>
                      <div className="flex gap-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
                        {skill.totalDamage > 0 && (
                          <span>
                            데미지: <span style={{ color: '#e5a440' }}>{skill.avgDamagePerUse.toFixed(0)}</span>/회
                          </span>
                        )}
                        {skill.totalHealing > 0 && (
                          <span>
                            힐: <span style={{ color: '#3db88a' }}>{(skill.totalHealing / skill.totalUses).toFixed(0)}</span>/회
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 힐 통계 요약 */}
          {result.healingStats && (result.healingStats.unit1TotalHealing > 0 || result.healingStats.unit2TotalHealing > 0) && (
            <div className="pt-3 border-t" style={{ borderColor: 'var(--border-primary)' }}>
              <div className="text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>{t('healingStats')}</div>
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2 rounded-lg text-center" style={{ background: 'var(--bg-primary)' }}>
                  <div className="text-lg font-bold" style={{ color: '#3db88a' }}>
                    {result.healingStats.unit1HPS.toFixed(1)}
                  </div>
                  <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {unit1Stats.name} HPS
                  </div>
                </div>
                <div className="p-2 rounded-lg text-center" style={{ background: 'var(--bg-primary)' }}>
                  <div className="text-lg font-bold" style={{ color: '#3db88a' }}>
                    {result.healingStats.unit2HPS.toFixed(1)}
                  </div>
                  <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {unit2Stats.name} HPS
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 결과 내보내기 + 시트 commit */}
      <div className="flex gap-2 flex-wrap">
        {onSaveToSheet && (
          <button
            onClick={onSaveToSheet}
            className="flex-1 min-w-[140px] py-2 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors hover:opacity-90"
            style={{ background: 'var(--accent)', color: 'white' }}
            title="현재 시트에 시뮬 결과 행 추가"
          >
            <FileSpreadsheet className="w-4 h-4" />
            시트에 저장
          </button>
        )}
        <button
          onClick={() => onExport('json')}
          className="flex-1 min-w-[120px] py-2 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors hover:opacity-80"
          style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
        >
          <Download className="w-4 h-4" />
          {t('exportJson')}
        </button>
        <button
          onClick={() => onExport('csv')}
          className="flex-1 min-w-[120px] py-2 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors hover:opacity-80"
          style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
        >
          <Download className="w-4 h-4" />
          {t('exportCsv')}
        </button>
      </div>
    </div>
  );
}
