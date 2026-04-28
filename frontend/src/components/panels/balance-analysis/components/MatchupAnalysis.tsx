/**
 * MatchupAnalysis - 상성 분석 컴포넌트
 */

'use client';

import { X, TrendingUp, GitBranch, AlertTriangle, Maximize2 } from 'lucide-react';
import type { PerfectImbalanceResult } from '@/lib/balanceAnalysis';
import type { Column } from '@/types';
import { ColumnMappingConfig, type ColumnMapping } from './ColumnMappingConfig';
import CustomSelect from '@/components/ui/CustomSelect';
import { useTranslations } from 'next-intl';

const PANEL_COLOR = '#7c7ff2';

interface MatchupAnalysisProps {
  units: { id: string; name: string }[];
  runsPerMatch: number;
  setRunsPerMatch: (value: number) => void;
  isAnalyzing: boolean;
  matchupResult: PerfectImbalanceResult | null;
  onRunAnalysis: () => void;
  onShowMatrix: () => void;
  columns: Column[];
  columnMapping: ColumnMapping;
  onMappingChange: (mapping: ColumnMapping) => void;
}

// 승률 매트릭스 색상 함수
export const getMatrixColor = (rate: number, isSelf: boolean) => {
  if (isSelf) return { bg: 'var(--bg-primary)', text: 'var(--text-secondary)' };

  if (rate >= 0.7) return { bg: '#6ec9b8', text: '#1a4a42' };
  if (rate >= 0.6) return { bg: '#9edcd0', text: '#1a4a42' };
  if (rate >= 0.55) return { bg: '#c8ebe4', text: '#2d635a' };
  if (rate <= 0.3) return { bg: '#d4908f', text: '#4a2020' };
  if (rate <= 0.4) return { bg: '#e8b8b7', text: '#5c2d2d' };
  if (rate <= 0.45) return { bg: '#f5d9d8', text: '#6b3a3a' };
  return { bg: 'var(--bg-primary)', text: 'var(--text-primary)' };
};

export function MatchupAnalysis({
  units,
  runsPerMatch,
  setRunsPerMatch,
  isAnalyzing,
  matchupResult,
  onRunAnalysis,
  onShowMatrix,
  columns,
  columnMapping,
  onMappingChange,
}: MatchupAnalysisProps) {
  const t = useTranslations();
  return (
    <div className="space-y-4">
      {/* 탭 설명 */}
      <div className="glass-section p-3 rounded-lg" style={{ borderLeft: `3px solid ${PANEL_COLOR}` }}>
        <div className="text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>{t('matchupAnalysis.header')}</div>
        <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('matchupAnalysis.description')}</div>
      </div>

      {/* 컬럼 매핑 설정 */}
      <ColumnMappingConfig
        mapping={columnMapping}
        onMappingChange={onMappingChange}
        columns={columns}
        fields={[
          { key: 'name', label: t('matchupAnalysis.colName'), description: t('matchupAnalysis.colNameDesc') },
          { key: 'hp', label: 'HP', required: true, description: t('matchupAnalysis.colHpDesc') },
          { key: 'atk', label: 'ATK', required: true, description: t('matchupAnalysis.colAtkDesc') },
          { key: 'def', label: 'DEF', description: t('matchupAnalysis.colDefDesc') },
          { key: 'speed', label: 'Speed', description: t('matchupAnalysis.colSpeedDesc') },
        ]}
        title={t('matchupAnalysis.columnSettings')}
        accentColor={PANEL_COLOR}
      />

      <div className="flex items-end gap-3">
        <div className="flex-1">
          <label className="text-sm mb-1 block" style={{ color: 'var(--text-secondary)' }}>
            {t('matchupAnalysis.matchupRunCount')}
          </label>
          <CustomSelect
            value={String(runsPerMatch)}
            onChange={(v) => setRunsPerMatch(Number(v))}
            options={[
              { value: '20', label: t('matchupAnalysis.opt20') },
              { value: '50', label: t('matchupAnalysis.opt50') },
              { value: '100', label: t('matchupAnalysis.opt100') },
            ]}
            color={PANEL_COLOR}
            size="sm"
          />
        </div>
        <button
          onClick={onRunAnalysis}
          disabled={isAnalyzing || units.length < 2}
          className="glass-button-primary px-4 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50"
          style={{ background: PANEL_COLOR }}
        >
          {isAnalyzing ? t('matchupAnalysis.analyzing') : t('matchupAnalysis.runAnalysis')}
        </button>
      </div>

      {matchupResult && (
        <MatchupResults matchupResult={matchupResult} onShowMatrix={onShowMatrix} />
      )}

      {units.length < 2 && (
        <div className="text-center py-8" style={{ color: 'var(--text-secondary)' }}>
          {t('matchupAnalysis.minTwoUnits')}
        </div>
      )}
    </div>
  );
}

interface MatchupResultsProps {
  matchupResult: PerfectImbalanceResult;
  onShowMatrix: () => void;
}

function MatchupResults({ matchupResult, onShowMatrix }: MatchupResultsProps) {
  const t = useTranslations();
  return (
    <div className="space-y-4">
      {/* 밸런스 점수 */}
      <div className="glass-card rounded-xl overflow-hidden">
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              {t('matchupAnalysis.balanceScore')}
            </span>
            <span className="glass-badge text-sm px-2 py-0.5 rounded-full font-medium" style={{
              background: matchupResult.balanceScore >= 70
                ? 'rgba(34, 197, 94, 0.15)'
                : matchupResult.balanceScore >= 40
                  ? 'rgba(251, 191, 36, 0.15)'
                  : 'rgba(239, 68, 68, 0.15)',
              color: matchupResult.balanceScore >= 70
                ? '#16a34a'
                : matchupResult.balanceScore >= 40
                  ? '#d97706'
                  : '#dc2626'
            }}>
              {matchupResult.balanceScore >= 70 ? t('matchupAnalysis.good') : matchupResult.balanceScore >= 40 ? t('matchupAnalysis.caution') : t('matchupAnalysis.danger')}
            </span>
          </div>
          <div className="flex items-end gap-3">
            <span
              className="text-4xl font-bold"
              style={{
                color: matchupResult.balanceScore >= 70
                  ? '#16a34a'
                  : matchupResult.balanceScore >= 40
                    ? '#d97706'
                    : '#dc2626'
              }}
            >
              {matchupResult.balanceScore.toFixed(0)}
            </span>
            <span className="text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>/ 100</span>
          </div>
          <div className="glass-progress mt-3 h-3 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${matchupResult.balanceScore}%`,
                background: matchupResult.balanceScore >= 70
                  ? 'linear-gradient(90deg, #3db88a, #5cc9a0)'
                  : matchupResult.balanceScore >= 40
                    ? 'linear-gradient(90deg, #e5a440, #f5c76a)'
                    : 'linear-gradient(90deg, #e86161, #f08080)'
              }}
            />
          </div>
        </div>
      </div>

      {/* 지배적/약한 유닛 */}
      {(matchupResult.dominantUnits.length > 0 || matchupResult.weakUnits.length > 0) && (
        <div className="glass-card rounded-xl overflow-hidden">
          {matchupResult.dominantUnits.length > 0 && (
            <div className="p-4" style={{ background: 'rgba(239, 68, 68, 0.05)', borderBottom: matchupResult.weakUnits.length > 0 ? '1px solid var(--border-primary)' : 'none' }}>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-5 h-5 rounded flex items-center justify-center" style={{ background: 'rgba(232, 97, 97, 0.15)' }}>
                  <AlertTriangle className="w-3 h-3" style={{ color: '#e86161' }} />
                </div>
                <span className="text-sm font-semibold" style={{ color: '#e86161' }}>
                  {t('matchupAnalysis.dominantUnit')}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {matchupResult.dominantUnits.map(u => (
                  <span key={u} className="glass-badge px-2.5 py-1 rounded-lg text-sm font-medium" style={{ background: 'rgba(232, 97, 97, 0.12)', color: '#e86161' }}>
                    {u}
                  </span>
                ))}
              </div>
            </div>
          )}
          {matchupResult.weakUnits.length > 0 && (
            <div className="p-4" style={{ background: 'rgba(90, 156, 245, 0.05)' }}>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-5 h-5 rounded flex items-center justify-center" style={{ background: 'rgba(90, 156, 245, 0.15)' }}>
                  <TrendingUp className="w-3 h-3 rotate-180" style={{ color: '#5a9cf5' }} />
                </div>
                <span className="text-sm font-semibold" style={{ color: '#5a9cf5' }}>
                  {t('matchupAnalysis.weakUnit')}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {matchupResult.weakUnits.map(u => (
                  <span key={u} className="glass-badge px-2.5 py-1 rounded-lg text-sm font-medium" style={{ background: 'rgba(90, 156, 245, 0.12)', color: '#5a9cf5' }}>
                    {u}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 가위바위보 순환 */}
      {matchupResult.cycles.length > 0 && (
        <div className="glass-card rounded-xl overflow-hidden">
          <div className="p-4" style={{ background: 'rgba(145, 121, 242, 0.05)' }}>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'rgba(145, 121, 242, 0.15)' }}>
                <GitBranch className="w-3.5 h-3.5" style={{ color: '#9179f2' }} />
              </div>
              <div>
                <div className="text-sm font-semibold" style={{ color: '#9179f2' }}>
                  {t('matchupAnalysis.piDetected')}
                </div>
                <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {t('matchupAnalysis.piExplain')}
                </div>
              </div>
            </div>
            <div className="space-y-2">
              {matchupResult.cycles.slice(0, 5).map((cycle, i) => (
                <div key={i} className="glass-section flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                  <span className="w-5 h-5 rounded-full flex items-center justify-center text-sm" style={{ background: 'rgba(145, 121, 242, 0.15)', color: '#9179f2' }}>
                    {i + 1}
                  </span>
                  {cycle.map((unit, j) => (
                    <span key={j} className="flex items-center gap-1.5">
                      <span>{unit}</span>
                      {j < cycle.length - 1 && <span style={{ color: '#9179f2' }}>→</span>}
                    </span>
                  ))}
                  <span style={{ color: '#9179f2' }}>→ {cycle[0]}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 승률 매트릭스 */}
      <div className="glass-card p-4 rounded-xl">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            {t('matchupAnalysis.winrateMatrix')}
          </div>
          <div className="flex items-center gap-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded" style={{ background: '#e8a9a9' }} />
              <span>{t('matchupAnalysis.weak')}</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded" style={{ background: '#d1d5db' }} />
              <span>{t('matchupAnalysis.balanced')}</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded" style={{ background: '#a8d8c8' }} />
              <span>{t('matchupAnalysis.strong')}</span>
            </div>
            <button
              onClick={onShowMatrix}
              className="glass-button p-1 rounded"
              title={t('matchupAnalysis.fullscreenView')}
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <div className="inline-block min-w-full">
            {/* 헤더 */}
            <div className="flex">
              <div className="w-20 h-10 flex items-center justify-center shrink-0" style={{ background: 'var(--bg-secondary)' }}>
                <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>vs</span>
              </div>
              {matchupResult.matrix.units.map((u) => (
                <div
                  key={u}
                  className="w-14 h-10 flex items-center justify-center shrink-0 border-l"
                  style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-primary)' }}
                >
                  <span className="text-sm font-medium truncate px-1" style={{ color: 'var(--text-secondary)' }} title={u}>
                    {u.length > 5 ? u.slice(0, 4) + '..' : u}
                  </span>
                </div>
              ))}
            </div>
            {/* 행들 */}
            {matchupResult.matrix.units.map((u, i) => (
              <div key={u} className="flex border-t" style={{ borderColor: 'var(--border-primary)' }}>
                <div className="w-20 h-10 flex items-center px-2 shrink-0" style={{ background: 'var(--bg-secondary)' }}>
                  <span className="text-sm font-medium truncate" style={{ color: 'var(--text-secondary)' }} title={u}>
                    {u.length > 8 ? u.slice(0, 7) + '..' : u}
                  </span>
                </div>
                {matchupResult.matrix.winRates[i].map((rate, j) => {
                  const colors = getMatrixColor(rate, i === j);

                  return (
                    <div
                      key={j}
                      className="w-14 h-10 flex items-center justify-center shrink-0 border-l transition-all hover:scale-105 hover:z-10 hover:shadow-lg cursor-default"
                      style={{
                        background: colors.bg,
                        color: colors.text,
                        borderColor: 'var(--border-primary)',
                      }}
                      title={i === j ? t('matchupAnalysis.self') : `${u} vs ${matchupResult.matrix.units[j]}: ${(rate * 100).toFixed(1)}%`}
                    >
                      <span className="text-sm font-medium">
                        {i === j ? '-' : `${(rate * 100).toFixed(0)}%`}
                      </span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        <div className="mt-3 pt-3 border-t text-sm" style={{ borderColor: 'var(--border-primary)', color: 'var(--text-secondary)' }}>
          {t('matchupAnalysis.matrixHelp')}
        </div>
      </div>
    </div>
  );
}

// 전체화면 모달
interface MatrixModalProps {
  matchupResult: PerfectImbalanceResult;
  onClose: () => void;
}

export function MatrixModal({ matchupResult, onClose }: MatrixModalProps) {
  const t = useTranslations();
  const unitCount = matchupResult.matrix.units.length;

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center p-0 sm:p-6 backdrop-blur-sm"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={onClose}
    >
      <div
        className="glass-panel overflow-hidden flex flex-col w-full sm:w-[90vw] h-[95vh] sm:h-[90vh] rounded-t-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 모달 헤더 */}
        <div className="glass-panel-header flex items-center justify-between px-6 py-4 shrink-0">
          <div>
            <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>{t('matchupAnalysis.winrateMatrix')}</h2>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('matchupAnalysis.fullMatrixSubtitle')}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded" style={{ background: '#e8a9a9' }} />
                <span>{t('matchupAnalysis.weak')}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded" style={{ background: '#d1d5db' }} />
                <span>{t('matchupAnalysis.balanced')}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded" style={{ background: '#a8d8c8' }} />
                <span>{t('matchupAnalysis.strong')}</span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="glass-button p-2 rounded-lg"
              style={{ color: 'var(--text-secondary)' }}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 모달 내용 */}
        <div className="flex-1 p-6 overflow-hidden flex items-center justify-center">
          <div
            className="grid w-full h-full"
            style={{
              gridTemplateColumns: `100px repeat(${unitCount}, 1fr)`,
              gridTemplateRows: `48px repeat(${unitCount}, 1fr)`,
              gap: '2px',
            }}
          >
            {/* 좌상단 vs 셀 */}
            <div
              className="flex items-center justify-center rounded-tl-lg"
              style={{ background: 'var(--bg-tertiary)' }}
            >
              <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>vs</span>
            </div>

            {/* 헤더 행 */}
            {matchupResult.matrix.units.map((u, idx) => (
              <div
                key={`header-${u}`}
                className={`flex items-center justify-center ${idx === unitCount - 1 ? 'rounded-tr-lg' : ''}`}
                style={{ background: 'var(--bg-tertiary)' }}
              >
                <span
                  className="text-sm font-medium truncate px-2"
                  style={{ color: 'var(--text-secondary)' }}
                  title={u}
                >
                  {u}
                </span>
              </div>
            ))}

            {/* 데이터 행들 */}
            {matchupResult.matrix.units.map((u, i) => (
              <>
                {/* 행 라벨 */}
                <div
                  key={`label-${u}`}
                  className={`flex items-center px-3 ${i === unitCount - 1 ? 'rounded-bl-lg' : ''}`}
                  style={{ background: 'var(--bg-tertiary)' }}
                >
                  <span
                    className="text-sm font-medium truncate"
                    style={{ color: 'var(--text-secondary)' }}
                    title={u}
                  >
                    {u}
                  </span>
                </div>

                {/* 데이터 셀들 */}
                {matchupResult.matrix.winRates[i].map((rate, j) => {
                  const colors = getMatrixColor(rate, i === j);
                  const isLastRow = i === unitCount - 1;
                  const isLastCol = j === unitCount - 1;

                  return (
                    <div
                      key={`cell-${i}-${j}`}
                      className={`flex items-center justify-center transition-all hover:scale-105 hover:z-10 hover:shadow-lg cursor-default ${isLastRow && isLastCol ? 'rounded-br-lg' : ''}`}
                      style={{
                        background: colors.bg,
                        color: colors.text,
                      }}
                      title={i === j ? t('matchupAnalysis.self') : `${u} vs ${matchupResult.matrix.units[j]}: ${(rate * 100).toFixed(1)}%`}
                    >
                      <span className="text-base font-semibold">
                        {i === j ? '-' : `${(rate * 100).toFixed(0)}%`}
                      </span>
                    </div>
                  );
                })}
              </>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
