/**
 * DeadZoneAnalysis - 데드존 탐지 컴포넌트
 */

'use client';

import { AlertTriangle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { UnitStats } from '@/lib/simulation/types';
import { detectDeadZones } from '@/lib/balanceAnalysis';
import type { Column } from '@/types';
import { ColumnMappingConfig, type ColumnMapping } from './ColumnMappingConfig';

const PANEL_COLOR = '#e5a440';

interface DeadZoneAnalysisProps {
  units: UnitStats[];
  columns: Column[];
  columnMapping: ColumnMapping;
  onMappingChange: (mapping: ColumnMapping) => void;
}

export function DeadZoneAnalysis({
  units,
  columns,
  columnMapping,
  onMappingChange,
}: DeadZoneAnalysisProps) {
  const t = useTranslations('balanceAnalysis');
  const statLabels: Record<string, string> = {
    hp: t('statHpLong'),
    atk: t('statAtkLong'),
    def: t('statDefLong'),
    speed: t('statSpeedLong'),
  };

  return (
    <div className="space-y-4">
      {/* 탭 설명 */}
      <div className="glass-section p-3 rounded-lg" style={{ borderLeft: `3px solid ${PANEL_COLOR}` }}>
        <div className="font-medium text-sm mb-1" style={{ color: 'var(--text-primary)' }}>{t('deadZoneTitle')}</div>
        <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          {t('deadZoneDesc')}
        </div>
      </div>

      {/* 컬럼 매핑 설정 */}
      <ColumnMappingConfig
        mapping={columnMapping}
        onMappingChange={onMappingChange}
        columns={columns}
        fields={[
          { key: 'hp', label: t('fieldHp'), description: t('fieldHpDesc') },
          { key: 'atk', label: t('fieldAtk'), description: t('fieldAtkDesc') },
          { key: 'def', label: t('fieldDef'), description: t('fieldDefDesc') },
          { key: 'speed', label: t('fieldSpeed'), description: t('fieldSpeedDesc') },
        ]}
        title={t('pickColumns')}
        accentColor={PANEL_COLOR}
      />

      {/* 선택된 스탯만 분석 */}
      {(() => {
        const selectedStats = (['hp', 'atk', 'def', 'speed'] as const).filter(
          stat => columnMapping[stat]
        );

        if (selectedStats.length === 0) {
          return (
            <div className="glass-card text-center py-8 rounded-xl">
              <AlertTriangle className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--text-secondary)' }} />
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                {t('selectColumns')}
              </p>
            </div>
          );
        }

        return (
          <div className="glass-card rounded-xl overflow-hidden">
            {selectedStats.map((stat, idx) => {
              const deadZones = detectDeadZones(units, stat as keyof UnitStats);
              const hasIssue = deadZones.length > 0;

              return (
                <div
                  key={stat}
                  className="p-4"
                  style={{
                    background: hasIssue ? 'rgba(245, 158, 11, 0.04)' : 'transparent',
                    borderBottom: idx < selectedStats.length - 1 ? '1px solid var(--border-primary)' : 'none'
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {statLabels[stat]}
                      </span>
                    </div>
                    {hasIssue ? (
                      <span className="glass-badge flex items-center gap-1 text-sm px-2 py-0.5 rounded-full font-medium" style={{ background: 'rgba(229, 164, 64, 0.15)', color: '#e5a440' }}>
                        <AlertTriangle className="w-3 h-3" />
                        {t('issuesCount', { count: deadZones.length })}
                      </span>
                    ) : (
                      <span className="glass-badge text-sm px-2 py-0.5 rounded-full font-medium" style={{ background: 'rgba(61, 184, 138, 0.1)', color: '#3db88a' }}>
                        {t('ok')}
                      </span>
                    )}
                  </div>
                  {hasIssue ? (
                    <div className="space-y-1.5 mt-2">
                      {deadZones.map((dz, i) => (
                        <div key={i} className="glass-section flex items-start gap-2 text-sm p-2 rounded-lg" style={{ background: 'rgba(245, 158, 11, 0.08)' }}>
                          <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" style={{ color: '#e5a440' }} />
                          <span style={{ color: 'var(--text-secondary)' }}>{dz.reason}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {t('distOk')}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })()}
    </div>
  );
}
